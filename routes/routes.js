import { Router } from "express";
import { upload } from "../middleware/multer.js";
import sendAllUser from "../controller/user controller/userController.js";
import { showChatHistory, saveMsgWithImg, saveMsg, editMessage, deleteMessage } from "../controller/message controller/msgController.js";
import multer from "multer";

const router = Router();

// Get all users
router.get("/users", sendAllUser);

router.get("/", (req, res) => {
  res.send("welcome to socket server");
});

// Get messages between 2 users
router.get("/messages/:from/:to", showChatHistory);

router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: "File upload error" });
      } else if (err) {
        return res.status(500).json({ error: "Server error" });
      }
      next();
    });
  },
  saveMsgWithImg
);

router.post("/send-message", saveMsg );

router.patch("/messages/edit", editMessage);

router.patch("/messages/delete", deleteMessage);

export default router;
