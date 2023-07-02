import express from 'express';
import user from './user/user'

const router = express.Router();

router.use("/user", user)

export default router;