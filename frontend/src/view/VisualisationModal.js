import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Modal, Select, Dropdown, Slider, InputNumber, Input } from 'antd';
import { Chart, Geom, Axis, Legend, Coord, Tooltip, Label } from 'bizcharts';
import { View as dataView} from '@antv/data-set';

import * as ViewActionCreators from './ViewActions';

const {Option} = Select;

class VisualisationModal extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;
    this.state = {
      chartType: "barChart",
      colIndexSelected: "",
      numCols: 5,
      defaultRange:[]
    };
    this.boundActionCreators = bindActionCreators(ViewActionCreators, dispatch);
  };

  render() {
    const { dispatch, visualisation_visible, error, view, columnIndex, userId} = this.props;
    const { chartType, numCols, rangeMin, rangeMax, defaultRange } = this.state;
    const colIndexSelected = this.state.colIndexSelected ? this.state.colIndexSelected : columnIndex;
    const MAX_COL = 15;

    let dv;
    let cols;
    let colNameSelected;
    let defaultMax=1;
    let defaultMin=100;

    if(view && colIndexSelected){

      colNameSelected = view.columns[colIndexSelected]['field'];

      //Barchar ploting
      if(chartType==="barChart"){

        cols = {
          colNameSelected: {tickInterval: 5},
        };

        dv = new dataView()
        .source(view.data)
        //pick selected column and drop others
        .transform({type: 'pick', fields: [colNameSelected]})
        //count based on colNameSelected
        .transform({type: 'aggregate', fields: [colNameSelected], 
          operations: 'count', as: 'count',
          groupBy: [colNameSelected]});
          console.log(dv.rows);

        //if current column type is number, then we can combine bars with user defined intervals
        if(view.columns[colIndexSelected]['type']==="number"){
          //sort current column values
          dv.transform({type: 'sort', callback(a, b) { 
            if(a[colNameSelected]!=="" && b[colNameSelected]!==""){
              return a[colNameSelected] - b[colNameSelected];
            }
            //put empty rows at first
            if(a[colNameSelected]===""){ return -1; }
            if(b[colNameSelected]===""){ return 1; }
          }});

          if(dv.rows.length>MAX_COL){
            //min and max value for slider
            defaultMin = Number(dv.rows[1][colNameSelected]);
            defaultMax = Number(dv.rows[dv.rows.length-1][colNameSelected]);
            
            //min and max value for calculating interval
            const min = rangeMin? rangeMin : defaultMin;
            const max = rangeMax? rangeMax : defaultMax;
            //interval is current range=max-min divided by number of columns which is given by the user
            //round up the result so that we always get the number of columns user defined
            const interval = Math.ceil((max-min)/numCols);

            //if user customize range, we filter out rows with values outside of this range
            if (rangeMin && rangeMax){
              dv.transform({
                type: 'filter',
                callback(row) {
                  return row[colNameSelected] > min && row[colNameSelected] < max ;
                }
              });
            }
            
            //mark each column with corresponding interval number, stored in mergeIndex field
            dv.transform({
              type: 'map',
              callback: (row, i)=>{
                if(row[colNameSelected]===""){ row.mergeIndex = 0; }
                else{ row.mergeIndex = Math.ceil(row[colNameSelected]/interval); }
                return row;
            }})
            //count how many rows are in each interval
            .transform({
              type: 'aggregate', fields: ["count"], 
              operations: 'sum', as: 'summation',
              groupBy: ["mergeIndex"]
            })
            //label each bar with the start and end number of corresponding interval
            .transform({
              type: 'map',
              callback: (row, i)=>{
                if(row[colNameSelected]===""){
                  row.axisLabel = "";
                }
                else{
                  row.axisLabel = ''+(min + interval*(row.mergeIndex-1))+'-'+(min + interval*row.mergeIndex);
                }
                return row;
            }});
          }      
        }
        else{
          //put empty rows at firsts
          dv.transform({type: 'sort', callback(a, b) { 
            if(a[colNameSelected]===""){ return -1; }
            if(b[colNameSelected]===""){ return 1; }
          }});
        }
      }

      //ploting pie chart
      if(chartType==="pieChart"){
        //show percentage for each piece of pie chart with two decimal float number
        cols = {
          percent: {
            formatter: val => {
              val = parseFloat(val * 100).toFixed(2) + '%';
              return val;
        }}};

        //count the percentage for each value in column selected by user
        dv = new dataView()
        .source(view.data)
        .transform({type: 'pick', fields: [colNameSelected]})
        .transform({type: 'aggregate', fields: [colNameSelected],
                    operations: 'count', as: 'count',
                    groupBy: [colNameSelected]})
        .transform({type: 'percent', field: 'count',
                    dimension: colNameSelected, as: 'percent'});
      }

      //ploting the box chart
      if(chartType==="boxPlot"){
        dv = new dataView()
        .source(view.data)
        .transform({type: 'pick', fields: [colNameSelected]})
        //filter out rows with empty value in colNameSelected
        .transform({
          type: 'filter',
          callback(row) {
              return row[colNameSelected]!=="";
        }})
        //convert string to number
        .transform({
          type: 'map',
          callback: (obj) => {
            obj[colNameSelected] = Number(obj[colNameSelected]);
            return obj;
        }})
        //calculate quantile values
        .transform({
          type: 'bin.quantile',
          field: colNameSelected,
          as: 'range',
          fraction: 4
        })
        //restore q1 median q3 high and low for label later 
        .transform({
          type: 'map',
          callback: (row) => {
            row.low = row.range[0]; row.q1 = row.range[1];
            row.median = row.range[2]; row.q3 = row.range[3];
            row.high = row.range[4]; row.na = colNameSelected;
            return row;
        }});

        cols ={
          range: {
            max: dv.rows[0].high
        }}
      }
    }

    return (
      <Modal
        width={700}
        visible={visualisation_visible}
        title={'Visualisation'}
        onCancel={() => { this.boundActionCreators.closeVisualisationModal(); 
                          this.setState({chartType:"barChart", colIndexSelected:""}); }}
      >
      <div style={{display:"flex", justifyContent:"left", alignItems: "center", marginBottom: 20}}>
        <h4>Chart type: </h4>
        <Select
          style={{ width: 150, marginLeft:15, display:"flex"}}
          value={chartType}
          onChange={(value)=>{this.setState({chartType: value})}}
        >
          <Option value="barChart">Barchart</Option>
          <Option value="pieChart">Piechart</Option>
          <Option value="boxPlot">Boxplot</Option>
        </Select>

      { userId &&
        <div style={{display:"flex", justifyContent:"left", alignItems: "center"}}>
          <h4>Columns: </h4>
          <Select
            style={{ width: 150, marginLeft:10, display:"flex"}}
            value={colNameSelected}
            onChange={
              (value)=>{
                this.setState({colIndexSelected: value});
              }
            }
          >
          {view.columns.map((column, i) => {
            return(
              <Option value={i} key={i}>{column.label ? column.label : column.field}</Option>
            )
          })}
        </Select>
        </div>
      }
      </div>

      { chartType === "barChart" && dv &&
        <div>
          <Chart height={450} data={dv} scale={cols} forceFit>
            <Axis name={dv.rows[0]["axisLabel"]?"axisLabel":colNameSelected} label={{autoRotate: true}} title={colNameSelected} />
            <Axis title={"Count"} name= {"count"} />
            <Tooltip crosshairs={{type : "y"}} />
            <Geom type="interval" position={dv.rows[0]["axisLabel"]? "axisLabel*summation": colNameSelected+"*count"} />
          </Chart>

          { dv && dv.rows[0]["axisLabel"] &&
          <div>
            <div style={{display: "flex", justifyContent: "left", marginBottom: 10, alignItems: "center"}}>
              <h4>Interval: </h4>
              <InputNumber min={1}
                style={{display: "flex", marginRight:15, marginLeft:5}}
                max={defaultMax}
                value={this.state.numCols}
                onChange={(value) => {this.setState({numCols: value})}}
              />
              <Slider style={{display: "flex", width:"350px", marginRight:10}} defaultValue={5} value={this.state.numCols}  min={1} max={defaultMax} onChange={(value) => {this.setState({numCols: value})} }/>
            </div>

            <div style={{display: "flex", justifyContent: "left", alignItems: "center"}}>
              <h4 style={{verticalAlign:"middle"}}>Min: </h4>
              <InputNumber min={defaultMin}
                max={defaultMax}
                style={{display: "flex", marginRight:10, marginLeft:5}}
                value={rangeMin ? rangeMin : defaultMin}
                onChange={(value) => {if(value<rangeMax){this.setState({rangeMin: value})}}}
              />

              <h4>Max: </h4>
              <InputNumber min={defaultMin}
                max={defaultMax}
                style={{display: "flex", marginLeft:5, marginRight:15}}
                value={rangeMax ? rangeMax : defaultMax}
                onChange={(value) => { if(value>rangeMin){this.setState({rangeMax: value});}}}
              />
              <Slider range 
                defaultValue={[defaultMin, defaultMax]} 
                value={rangeMax && rangeMin ? [rangeMin, rangeMax] : [defaultMin, defaultMax]} 
                style={{display: "flex", width:"350px", marginRight:10}}
                min={defaultMin} 
                max={defaultMax}
                onChange={(value) => {{this.setState({rangeMin: value[0], rangeMax: value[1]});}}}/>
            </div>
          </div>
          }
        </div>
      }

      { chartType==="pieChart" &&
        <div>
          <Chart height={450} data={dv} scale={cols} padding={[ 80, 100, 80, 80 ]} forceFit>
            <Coord type='theta' radius={0.75} />
            <Axis name="percent" />
            <Legend position='right' offsetY={-window.innerHeight / 2 +330} offsetX={-30} />
            <Tooltip 
              showTitle={false} 
              itemTpl='<li>
                        <span style="background-color:{color};" class="g2-tooltip-marker"></span>
                        {name}: {value}
                      </li>'
            />
            <Geom
              type="intervalStack"
              position="percent"
              color={colNameSelected}
              tooltip={[colNameSelected+'*percent',(colNameSelected, percent) => {
                percent = parseInt(percent * 100, 10) + '%';
                return {
                  name: colNameSelected,
                  value: percent
                };
              }]}
              style={{lineWidth: 1,stroke: '#fff'}}
              >
              <Label 
                content='percent' 
                formatter={(val, item) => {return item.point[colNameSelected] + ': ' + val;}} 
              />
            </Geom>
          </Chart>
        </div>
      }

      { chartType==="boxPlot" &&
        <div>
          <Chart height={450} data={dv} scale={cols} padding={[ 20, 120, 95 ]} forceFit>
            <Axis name='na' />
            <Axis name='range' />
            <Tooltip showTitle={false} crosshairs={{type:'rect',style: {fill: '#E4E8F1',fillOpacity: 0.43}}}     
            itemTpl='<li style="margin-bottom:4px;">
                    <span style="background-color:{color};" class="g2-tooltip-marker"></span>
                    {name}<br/>
                    <span style="padding-left: 16px">Max: {high}</span><br/>
                    <span style="padding-left: 16px">Upper quartile: {q3}</span><br/>
                    <span style="padding-left: 16px">Median: {median}</span><br/>
                    <span style="padding-left: 16px">Lower quartile: {q1}</span><br/>
                    <span style="padding-left: 16px">Min: {low}</span><br/></li>'/>
            <Geom type="schema" position="na*range" shape='box' tooltip={['na*low*q1*median*q3*high', (na, low, q1, median, q3, high) => {
              return {
                name: na, low, q1, median, q3, high
              };
              }]} 
              style={{stroke: 'rgba(0, 0, 0, 0.45)',fill: '#1890FF',fillOpacity: 0.3}}  
            />
          </Chart>
        </div>
      }
      </Modal>
    );
  };
};

const mapStateToProps = (state) => {
  const { 
    visualisation_visible, error, view, columnIndex, userId
  } = state.view;
  
  return { 
    visualisation_visible, error, view, columnIndex, userId
  };
};

export default connect(mapStateToProps)(VisualisationModal);
