from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    group = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    def get_group(self, user):
        return ",".join([group.name for group in user.groups.all()])

    def get_name(self, user):
        return user.name

    class Meta:
        model = User
        fields = "__all__"
