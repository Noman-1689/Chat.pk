import Chat from "../models/chat.model.js";
import Message from "../models/messages.model.js";

export const getUserChats = async (req, res) => {
  try {
    const allChats = await Chat.find({ participants: req.userId })
      .populate("participants", "firstName lastName email")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });
    res.json(allChats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createGroupChat = async (req, res) => {
  const { name, members } = req.body;

  // 1. Validation
  if (!name || !members || !Array.isArray(members)) {
    return res
      .status(400)
      .json({ message: "GROUP NAME AND MEMBERS ARE REQUIRED" });
  }

  // A group chat usually requires at least 2 other people + the creator
  if (members.length < 2) {
    return res
      .status(400)
      .json({ message: "SELECT AT LEAST 2 FRIENDS TO FORM A GROUP" });
  }

  try {
    // 2. Prepare the participants list
    // Add the current user (req.user.id) and ensure no duplicates
    const allParticipants = [...new Set([...members, req.user.id])];

    // 3. Create the Group Chat
    const groupChat = await Chat.create({
      chatName: name.toUpperCase(), // Keeping your brutalist aesthetic
      isGroupChat: true,
      participants: allParticipants,
      groupAdmin: req.user.id, // The creator is the admin
    });

    // 4. Populate the data to send back to the frontend
    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("participants", "firstName lastName email")
      .populate("groupAdmin", "firstName lastName email");

    res.status(201).json(fullGroupChat);
  } catch (error) {
    console.error("CREATE_GROUP_ERROR:", error.message);
    res.status(500).json({ error: "INTERNAL SERVER ERROR" });
    console.log(error);
  }
};

export const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;

    // 1. Find the chat by ID
    // 2. Populate the 'participants' field
    // 3. Select only 'firstName', 'lastName', and '_id' from the User documents
    const chat = await Chat.findById(chatId)
      .populate({
        path: "participants",
        select: "firstName lastName _id",
      })
      .select("chatName participants isGroupChat");

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Response includes:
    // - chatName (Group Name)
    // - participants (Array of objects with ID, firstName, and lastName)
    res.status(200).json({
      groupName: chat.chatName,
      isGroupChat: chat.isGroupChat,
      participants: chat.participants,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const allMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    // 1. Find all messages belonging to the specific chat ID
    // 2. Populate 'sender' to get the user object (firstName, lastName, etc.)
    // 3. Populate 'chat' if you need the full chat object, otherwise leave as ID
    const messages = await Message.find({ chat: chatId })
      .populate("sender", "firstName lastName _id")
      .populate("chat")
      .sort({ createdAt: 1 }); // Ensures chronological order

    // Sending back just the array as requested: [{...}, {...}]
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({
      message: "Could not retrieve transmission logs",
      error: error.message,
    });
  }
};

export const allMessagesTU = async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;

    // 1. Find the private chat (DM) involving exactly these two users
    const chat = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { participants: { $elemMatch: { $eq: userId } } },
        { participants: { $elemMatch: { $eq: targetUserId } } },
      ],
    });

    // 2. If no chat exists yet, there are no messages to return
    if (!chat) {
      return res.status(200).json([]);
    }

    // 3. Find all messages belonging to the found chatId
    const messages = await Message.find({ chat: chat._id })
      .populate("sender", "firstName lastName _id")
      .populate("chat")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({
      message: "Could not retrieve transmission logs",
      error: error.message,
    });
  }
};
