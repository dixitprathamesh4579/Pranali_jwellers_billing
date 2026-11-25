import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../utils/api.js";
import "./WhatsAppChats.css";

const formatTime = (date) => {
    if (!date) return "";

    const messageDate = new Date(date);

    if (isNaN(messageDate.getTime())) return "";

    return messageDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDate = (date) => {
    if (!date) return "";

    const messageDate = new Date(date);

    if (isNaN(messageDate.getTime())) return "";

    return messageDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const WhatsAppChats = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);

    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const [error, setError] = useState("");

    // Fetch all conversations
    const fetchConversations = useCallback(async () => {
        try {
            const response = await apiFetch("/whatsapp/conversations");

            if (!response.ok) {
                throw new Error("Failed to fetch conversations.");
            }

            const data = await response.json();

            setConversations(data.conversations || []);
        } catch (err) {
            setError(err.message || "Unable to load conversations.");
        } finally {
            setLoadingConversations(false);
        }
    }, []);

    // Mark conversation as read
    const markAsRead = async (conversationId) => {
        try {
            const response = await apiFetch(
                `/whatsapp/conversations/${conversationId}/read`,
                {
                    method: "PATCH",
                }
            );

            if (!response.ok) {
                throw new Error("Failed to mark conversation as read.");
            }

            setConversations((previous) =>
                previous.map((conversation) =>
                    conversation.id === conversationId
                        ? { ...conversation, unread_count: 0 }
                        : conversation
                )
            );
        } catch (err) {
            console.error("Mark as read error:", err);
        }
    };

    // Fetch messages of selected conversation
    const fetchMessages = useCallback(async (conversationId) => {
        if (!conversationId) return;

        try {
            const response = await apiFetch(
                `/whatsapp/conversations/${conversationId}/messages`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch messages.");
            }

            const data = await response.json();

            setMessages(data.messages || []);
        } catch (err) {
            console.error("Message fetch error:", err);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // Select conversation
    const handleSelectConversation = async (conversation) => {
        setSelectedConversation(conversation);
        setMessages([]);
        setLoadingMessages(true);

        await markAsRead(conversation.id);
        await fetchMessages(conversation.id);
    };

    // Initial fetch and automatic refresh
    useEffect(() => {
        fetchConversations();

        const interval = setInterval(() => {
            fetchConversations();
        }, 5000);

        return () => clearInterval(interval);
    }, [fetchConversations]);

    // Refresh selected conversation messages
    useEffect(() => {
        if (!selectedConversation?.id) return;

        const interval = setInterval(() => {
            fetchMessages(selectedConversation.id);
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedConversation?.id, fetchMessages]);

    const [messageInput, setMessageInput] = useState("");
    const [sendingMessage, setSendingMessage] = useState(false);
    const [sendError, setSendError] = useState("");
    // New Chat states
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState("");
    const [newChatName, setNewChatName] = useState("");
    const [creatingChat, setCreatingChat] = useState(false);
    const [newChatError, setNewChatError] = useState("");
    const handleSendMessage = async () => {
        const message = messageInput.trim();

        if (!message || !selectedConversation || sendingMessage) {
            return;
        }

        setSendingMessage(true);
        setSendError("");

        try {
            const response = await apiFetch(
                `/whatsapp/conversations/${selectedConversation.id}/messages`,
                {
                    method: "POST",
                    body: JSON.stringify({ message })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to send message."
                );
            }

            // Clear input after successful sending.
            setMessageInput("");

            // Immediately display the sent message.
            if (data.sentMessage) {
                setMessages(previous => [
                    ...previous,
                    data.sentMessage
                ]);
            }

            // Refresh conversation list.
            await fetchConversations();

            // Refresh messages to get the latest database records.
            await fetchMessages(selectedConversation.id);

        } catch (error) {
            setSendError(error.message || "Unable to send message.");
        } finally {
            setSendingMessage(false);
        }
    };

    // ==========================================
    // CREATE NEW WHATSAPP CONVERSATION
    // ==========================================

    const handleCreateConversation = async (event) => {
        event.preventDefault();

        if (!newChatPhone.trim()) {
            setNewChatError("Please enter a WhatsApp mobile number.");
            return;
        }

        setCreatingChat(true);
        setNewChatError("");

        try {
            const response = await apiFetch("/whatsapp/conversations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    phone: newChatPhone.trim(),
                    customer_name: newChatName.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to create conversation."
                );
            }

            if (!data.conversation) {
                throw new Error("Conversation was not returned by the server.");
            }

            const conversation = data.conversation;

            // Close modal and clear form.
            setShowNewChatModal(false);
            setNewChatPhone("");
            setNewChatName("");
            setNewChatError("");

            // Open the newly created conversation.
            setSelectedConversation(conversation);
            setMessages([]);
            setLoadingMessages(true);

            // Refresh sidebar and fetch messages.
            await fetchConversations();
            await fetchMessages(conversation.id);

        } catch (error) {
            setNewChatError(
                error.message || "Unable to create conversation."
            );
        } finally {
            setCreatingChat(false);
        }
    };

    const handleMessageKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="whatsapp-chats-page">

            {/* HEADER */}
            <div className="whatsapp-chats-header">
                <div>
                    <h2>WhatsApp Chats</h2>
                    <p>Manage your customer conversations</p>
                </div>

                <div className="whatsapp-chat-total">
                    {conversations.length} Conversations
                </div>
            </div>
            {/* ==========================================
    NEW CHAT MODAL
========================================== */}

            {showNewChatModal && (
                <div
                    className="whatsapp-new-chat-overlay"
                    onClick={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !creatingChat
                        ) {
                            setShowNewChatModal(false);
                        }
                    }}
                >

                    <div className="whatsapp-new-chat-modal">

                        <h3>Start New Chat</h3>

                        <p>
                            Enter the customer's WhatsApp mobile number
                            to start a conversation.
                        </p>

                        <form onSubmit={handleCreateConversation}>

                            <label>
                                Customer Name (Optional)
                            </label>

                            <input
                                type="text"
                                placeholder="Enter customer name"
                                value={newChatName}
                                onChange={(e) =>
                                    setNewChatName(e.target.value)
                                }
                                maxLength={150}
                                disabled={creatingChat}
                            />

                            <label>
                                WhatsApp Mobile Number *
                            </label>

                            <input
                                type="tel"
                                placeholder="Enter 10-digit mobile number"
                                value={newChatPhone}
                                onChange={(e) =>
                                    setNewChatPhone(e.target.value)
                                }
                                maxLength={16}
                                required
                                disabled={creatingChat}
                            />

                            {newChatError && (
                                <div className="whatsapp-new-chat-error">
                                    {newChatError}
                                </div>
                            )}

                            <div className="whatsapp-new-chat-actions">

                                <button
                                    type="button"
                                    className="whatsapp-new-chat-cancel"
                                    disabled={creatingChat}
                                    onClick={() =>
                                        setShowNewChatModal(false)
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="whatsapp-new-chat-create"
                                    disabled={
                                        creatingChat ||
                                        !newChatPhone.trim()
                                    }
                                >
                                    {creatingChat
                                        ? "Creating..."
                                        : "Create Chat"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}
            {error && (
                <div className="whatsapp-chat-error">
                    {error}
                </div>
            )}

            <div className="whatsapp-chat-container">

                {/* LEFT SIDEBAR */}
                <div className="whatsapp-conversations">

                    <div className="whatsapp-conversations-heading">

                        <h3>Messages</h3>

                        <button
                            type="button"
                            className="whatsapp-new-chat-btn"
                            onClick={() => {
                                setNewChatPhone("");
                                setNewChatName("");
                                setNewChatError("");
                                setShowNewChatModal(true);
                            }}
                        >
                            + New Chat
                        </button>

                    </div>

                    {loadingConversations ? (
                        <div className="whatsapp-chat-empty">
                            Loading conversations...
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="whatsapp-chat-empty">
                            No conversations yet.
                        </div>
                    ) : (
                        conversations.map((conversation) => (
                            <div
                                key={conversation.id}
                                className={`whatsapp-conversation-item ${selectedConversation?.id === conversation.id
                                    ? "active"
                                    : ""
                                    }`}
                                onClick={() =>
                                    handleSelectConversation(conversation)
                                }
                            >
                                <div className="whatsapp-avatar">
                                    {(conversation.customer_name ||
                                        conversation.whatsapp_phone ||
                                        "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div className="whatsapp-conversation-info">
                                    <div className="whatsapp-conversation-top">
                                        <strong>
                                            {conversation.customer_name ||
                                                conversation.whatsapp_phone}
                                        </strong>

                                        <span>
                                            {formatTime(
                                                conversation.last_message_at
                                            )}
                                        </span>
                                    </div>

                                    <div className="whatsapp-conversation-bottom">
                                        <p>
                                            {conversation.last_message ||
                                                "No messages"}
                                        </p>

                                        {Number(conversation.unread_count) > 0 && (
                                            <span className="whatsapp-unread-badge">
                                                {conversation.unread_count}
                                            </span>
                                        )}
                                    </div>

                                    <small>
                                        {conversation.whatsapp_phone}
                                    </small>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* RIGHT CHAT WINDOW */}
                <div className="whatsapp-chat-window">

                    {!selectedConversation ? (
                        <div className="whatsapp-chat-welcome">
                            <div className="whatsapp-welcome-icon">
                                💬
                            </div>

                            <h3>WhatsApp Messages</h3>

                            <p>
                                Select a conversation to view messages.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* CHAT HEADER */}
                            <div className="whatsapp-chat-header">
                                <div className="whatsapp-avatar">
                                    {(selectedConversation.customer_name ||
                                        selectedConversation.whatsapp_phone)
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div>
                                    <strong>
                                        {selectedConversation.customer_name ||
                                            selectedConversation.whatsapp_phone}
                                    </strong>

                                    <p>
                                        {selectedConversation.whatsapp_phone}
                                    </p>
                                </div>
                            </div>

                            {/* MESSAGES */}
                            <div className="whatsapp-messages">

                                {loadingMessages ? (
                                    <div className="whatsapp-chat-empty">
                                        Loading messages...
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="whatsapp-chat-empty">
                                        No messages in this conversation.
                                    </div>
                                ) : (
                                    messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`whatsapp-message-row ${message.direction === "OUTBOUND"
                                                ? "outgoing"
                                                : "incoming"
                                                }`}
                                        >
                                            <div className="whatsapp-message-bubble">
                                                <p>
                                                    {message.message_text ||
                                                        `[${message.message_type}]`}
                                                </p>

                                                <span>
                                                    {formatTime(message.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* INPUT PLACEHOLDER */}
                            <div className="whatsapp-chat-input-area">

                                {sendError && (
                                    <div className="whatsapp-send-error">
                                        {sendError}
                                    </div>
                                )}

                                <div className="whatsapp-chat-input-row">

                                    <textarea
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleMessageKeyDown}
                                        placeholder="Type a message..."
                                        rows={1}
                                        maxLength={4096}
                                        disabled={sendingMessage}
                                    />

                                    <button
                                        type="button"
                                        onClick={handleSendMessage}
                                        disabled={
                                            !messageInput.trim() ||
                                            sendingMessage
                                        }
                                    >
                                        {sendingMessage ? "Sending..." : "Send"}
                                    </button>

                                </div>

                                <small>
                                    Enter to send · Shift + Enter for a new line
                                </small>

                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppChats;