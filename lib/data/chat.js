// Chat data access layer — session and message persistence
import { getServerClient } from "@/lib/supabase";

// Create a new chat session
export async function createSession({ userName, userEmail, pageContext }) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_name: userName,
      user_email: userEmail,
      page_context: pageContext,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Close a session: set ended_at, summary, tools_used, message_count
export async function endSession({ sessionId, summary, toolsUsed }) {
  const supabase = getServerClient();

  const { count } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({
      ended_at: new Date().toISOString(),
      summary,
      tools_used: toolsUsed ?? [],
      message_count: count ?? 0,
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Add a message to a session
export async function addMessage(sessionId, { role, content, toolCalls, isAuto }) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      tool_calls: toolCalls ?? null,
      is_auto: isAuto ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get a session with all its messages
export async function getSession(sessionId) {
  const supabase = getServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError) throw sessionError;

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  return { ...session, messages };
}

// List recent sessions, optionally filtered by userId or message content search
export async function getRecentSessions({ limit = 20, userId, search } = {}) {
  const supabase = getServerClient();

  if (search) {
    // Find session IDs where any message matches the search term
    const { data: matchingMessages, error: msgError } = await supabase
      .from("chat_messages")
      .select("session_id")
      .ilike("content", `%${search}%`);

    if (msgError) throw msgError;

    const sessionIds = [...new Set(matchingMessages.map((m) => m.session_id))];
    if (sessionIds.length === 0) return [];

    let query = supabase
      .from("chat_sessions")
      .select("*")
      .in("id", sessionIds)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  let query = supabase
    .from("chat_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Get all messages for a session ordered by created_at ASC
export async function getSessionMessages(sessionId) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}
