import { Router } from "express";
import { createUser, getUser, listUsers, updateUser } from "../controllers/users.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Every route here is admin-only — staff must never be able to list, create,
// edit, or deactivate other accounts, even by calling the API directly.
router.use(authenticate, authorize("admin"));

router.get("/", listUsers);
router.get("/:id", getUser);
router.post("/", createUser);
router.put("/:id", updateUser);

export default router;
