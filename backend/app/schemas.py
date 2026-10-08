from pydantic import BaseModel, Field


class OtpRequest(BaseModel):
    identifier: str


class LoginBody(BaseModel):
    identifier: str
    otp: str


class RegisterBody(BaseModel):
    identifier: str
    otp: str
    display_name: str = Field(min_length=1, max_length=64)
    avatar_color: str | None = None
    avatar_url: str | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    about: str | None = Field(default=None, max_length=140)
    avatar_color: str | None = None
    avatar_url: str | None = None
    username: str | None = None


class ContactAdd(BaseModel):
    user_id: int | None = None
    identifier: str | None = None


class DirectCreate(BaseModel):
    user_id: int


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    member_ids: list[int] = Field(min_length=1)


class ConversationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    disappear_after: int | None = None
    clear_disappear: bool = False


class MembersAdd(BaseModel):
    user_ids: list[int] = Field(min_length=1)


class RoleUpdate(BaseModel):
    role: str


class MessageCreate(BaseModel):
    body: str = Field(default="", max_length=4000)
    client_id: str | None = Field(default=None, max_length=64)
    reply_to_id: int | None = None
    attachment_url: str | None = None
    attachment_name: str | None = None
    attachment_type: str | None = None
    attachment_size: int | None = None


class ReactionBody(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)
