import "dotenv/config";
import mongoose from "mongoose";
import { TeamMember } from "../model/teamMember.model.js";
import { founderVision } from "./team-content.js";

async function updateFounderVision() {
  if (!process.env.MONGO_DB_URL) {
    throw new Error("MONGO_DB_URL is not configured");
  }

  await mongoose.connect(process.env.MONGO_DB_URL);
  const member = await TeamMember.findOneAndUpdate(
    { seedKey: "team-sample-1" },
    { $set: { bio: founderVision } },
    { new: true }
  );

  if (!member) {
    throw new Error("Team Member 1 was not found");
  }

  console.log(`Founder vision updated for ${member.name}`);
}

updateFounderVision()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
