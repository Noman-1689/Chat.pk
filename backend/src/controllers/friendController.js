import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

// --- Send Request using Email ---
export const sendRequest = async (req, res) => {
  try {
    const { receiverEmail } = req.body;
    const senderId = req.user.id;

    if (!receiverEmail) {
      return res.status(400).json({ message: "Receiver email is required" });
    }

    // 1. Find the receiver by email
    const receiver = await User.findOne({ email: receiverEmail.toLowerCase() });

    if (!receiver) {
      return res
        .status(404)
        .json({ message: "User not found with that email" });
    }

    // 2. Prevent adding yourself
    if (senderId === receiver._id.toString()) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }

    // 3. Check if they are already friends
    const sender = await User.findById(senderId);
    if (sender.friends.includes(receiver._id)) {
      return res
        .status(400)
        .json({ message: "You are already friends with this user" });
    }

    // 4. Create the request
    const request = await FriendRequest.create({
      sender: senderId,
      receiver: receiver._id,
    });

    res.status(201).json({ message: "Friend request sent", request });
  } catch (error) {
    // Unique index prevents duplicate pending requests
    if (error.code === 11000) {
      return res
        .status(400)
        .json({
          message: "A friend request is already pending between you two",
        });
    }
    res.status(500).json({ error: error.message });
  }
};

// --- Get Pending Requests (So the user knows what to accept) ---
export const getPendingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user.id,
      status: "pending",
    }).populate("sender", "firstName lastName email");

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Accept Request (Uses the Request ID from the pending list) ---
export const acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findById(requestId);

    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Valid request not found" });
    }

    // 1. Update request status to accepted
    request.status = "accepted";
    await request.save();

    // 2. Add to both users' friends arrays ($addToSet prevents duplicates)
    await User.findByIdAndUpdate(request.sender, {
      $addToSet: { friends: request.receiver },
    });
    await User.findByIdAndUpdate(request.receiver, {
      $addToSet: { friends: request.sender },
    });

    res.status(200).json({ message: "Friendship established!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Get Confirmed Friends List ---
export const getMyFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "friends",
      "firstName lastName email",
    );
    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
