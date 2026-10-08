export type MsgStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface User {
  id: number;
  phone: string | null;
  username: string | null;
  display_name: string;
  about: string;
  avatar_color: string;
  avatar_url: string | null;
  online: boolean;
  last_seen_at: string | null;
}
export interface Member extends User { role: "admin" | "member"; joined_at: string }

export interface Attachment { url: string; name: string | null; type: string | null; size: number | null }
export interface ReplyPreview { id: number; sender_id: number | null; sender_name: string; body: string; attachment_type: string | null; is_deleted: boolean }
export interface Reaction { emoji: string; count: number; user_ids: number[] }

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender: { id: number; display_name: string; avatar_color: string; avatar_url: string | null } | null;
  kind: "text" | "system";
  body: string;
  is_deleted: boolean;
  reply_to: ReplyPreview | null;
  attachment: Attachment | null;
  client_id: string | null;
  created_at: string;
  expires_at: string | null;
  status: MsgStatus | null;
  receipts: { delivered: number; read: number; total: number } | null;
  reactions: Reaction[];
}

export interface Conversation {
  id: number;
  type: "direct" | "group";
  title: string;
  name: string | null;
  avatar_color: string;
  peer: Member | null;
  members: Member[];
  my_role: "admin" | "member" | null;
  created_by: number | null;
  disappear_after: number | null;
  created_at: string;
  updated_at: string;
  last_message: Message | null;
  unread_count: number;
}

export interface SearchResults {
  conversations: Conversation[];
  contacts: User[];
  messages: { message: Message; conversation_id: number; conversation_title: string }[];
}

export interface Toast { id: number; title: string; body?: string; kind?: "info" | "error" | "success" | "message"; onClick?: () => void }
export type ThemePref = "light" | "dark" | "system";
