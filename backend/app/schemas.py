from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

# Trimmed, non-empty text: "   " is rejected instead of silently becoming an empty name.
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
UploadPath = Annotated[str, StringConstraints(pattern=r"^/uploads/[0-9a-f]{32}(\.[a-z0-9]{1,9})?$")]


class OtpRequest(BaseModel):
    identifier: str


class LoginBody(BaseModel):
    identifier: str
    otp: str


class RegisterBody(BaseModel):
    identifier: str
    otp: str
    display_name: Name
    avatar_color: HexColor | None = None
    avatar_url: UploadPath | None = None


class ProfileUpdate(BaseModel):
    display_name: Name | None = None
    about: str | None = Field(default=None, max_length=140)
    avatar_color: HexColor | None = None
    avatar_url: UploadPath | None = None
    username: str | None = None


class ContactAdd(BaseModel):
    user_id: int | None = None
    identifier: str | None = None


class DirectCreate(BaseModel):
    user_id: int


class GroupCreate(BaseModel):
    name: Name
    member_ids: list[int] = Field(min_length=1)


class ConversationUpdate(BaseModel):
    name: Name | None = None
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
    attachment_url: UploadPath | None = None
    attachment_name: str | None = Field(default=None, max_length=255)
    attachment_type: str | None = Field(default=None, max_length=100)
    attachment_size: int | None = Field(default=None, ge=0)


class ReactionBody(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)
