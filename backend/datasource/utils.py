from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.engine.url import URL
from xlrd import open_workbook
import csv
import boto3
import io

from ontask.settings import SECRET_KEY, DB_DRIVER_MAPPING, SMTP,\
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION


def retrieve_sql_data(connection):
    '''Generic service to retrieve data from an SQL server with a provided query'''

    # Decrypt the password provided by the user to connect to the remote database
    cipher = Fernet(SECRET_KEY)
    try:
        decrypted_password = cipher.decrypt(
            bytes(connection['password'], encoding="UTF-8"))
    except:
        decrypted_password = cipher.decrypt(connection['password'])

    # Initialize the DB connection parameters
    connection_parameters = {
        'drivername': DB_DRIVER_MAPPING[connection['dbType']],
        'username': connection['user'],
        'password': decrypted_password,
        'host': connection['host'],
        'port': connection['port'] if 'port' in connection else None,
        'database': connection['database']
    }

    # SQL alchemy code to add connect to the external DB generically to access the query data
    engine = create_engine(URL(**connection_parameters))
    db_connection = engine.connect()

    # Stream the results from the user query
    # The stream_results=True argument here will eliminate the buffering of the query results
    # The result rows are not buffered, but fetched as they're needed.
    # Ref - http://dev.mobify.com/blog/sqlalchemy-memory-magic/
    try:
        results = db_connection.execution_options(
            stream_results=True).execute(connection['query'])
    except:
        raise Exception('Query returned an error')

    # Convert the buffered results into a list of dicts
    data = [dict(zip(row.keys(), row)) for row in results]

    db_connection.close()

    return data


def retrieve_csv_data(file, delimiter):
    '''Generic service to retrieve data from a csv file with a given delimiter (comma by default)'''
    delimiter = ',' if delimiter is None else delimiter

    file = file.read().decode('utf-8').split('\r\n')
    column_headers = file.pop(0).split(delimiter)
    modified_headers = set()
    for (index, header) in enumerate(column_headers):
        for char in ['.', '$', '"', "'"]:
            if char in header:
                new_header = header.replace(char, '')
                modified_headers.add((header, new_header))
                column_headers[index] = new_header

    file = '\r\n'.join(file)
    reader = csv.DictReader(io.StringIO(
        file), fieldnames=column_headers, delimiter=delimiter)
    data = list(reader)

    return data


def retrieve_excel_data(file, sheetname):
    ''' Generic service to retrieve data from the given sheetname of an excel file (supports both 
        .xls and .xlsx) '''

    book = open_workbook(file_contents=file.read())
    sheet = book.sheet_by_name(sheetname)

    number_of_columns = sheet.ncols
    number_of_rows = sheet.nrows

    # Identify the header of each column
    fields = [sheet.cell(0, y).value for y in range(number_of_columns)]

    # Initialize the list that will store the dicts which represent each row
    data = []

    # Iterate over the rows, skipping the first (i.e. the headers)
    for x in range(1, number_of_rows):
        data.append({fields[y]: sheet.cell(
            x, y).value for y in range(number_of_columns)})

    return data


def retrieve_file_from_s3(connection):
    ''' Generic service to retrieve the data from a file in an s3 bucket, depending on the 
        type of the file '''

    try:
        bucket = connection['bucket']
        file_name = connection['fileName']
        delimiter = connection['delimiter'] if 'delimiter' in connection else None
        sheetname = connection['sheetname'] if 'sheetname' in connection else None
    except:
        raise Exception('Invalid connection settings')

    try:
        # Connect to the specified bucket using the AWS credentials specified in the config
        session = boto3.Session(
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )

        # Get the specified file from the bucket
        s3 = session.resource('s3')
        obj = s3.Object(bucket, file_name)
        file = obj.get()['Body']

        # Parse the data based on the file type
        if file_name.lower().endswith(('.csv', '.txt')):
            return retrieve_csv_data(file, delimiter)
        elif file_name.lower().endswith(('.xls', '.xlsx')):
            return retrieve_excel_data(file, sheetname)
        else:
            raise Exception('File type is not supported')
    except:
        raise Exception('Error reading file from s3 bucket')
