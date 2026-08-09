import "dotenv/config";
import mongoose from "mongoose";
import { TeamMember } from "../model/teamMember.model.js";
import { founderVision } from "./team-content.js";

const members = [
  {
    seedKey: "team-sample-1",
    name: "Team Member 1 (Sample)",
    role: "Founder & CEO",
    bio: founderVision,
    imageUrl: "",
    sortOrder: 10,
    isPublished: true,
  },
  {
    seedKey: "team-sample-2",
    name: "Team Member 2 (Sample)",
    role: "Operations Lead",
    bio: "Replace this sample with the team member responsible for operations, partnerships, and dependable savings-circle workflows.",
    imageUrl: "",
    sortOrder: 20,
    isPublished: true,
  },
  {
    seedKey: "team-sample-3",
    name: "Team Member 3 (Sample)",
    role: "Product & Technology Lead",
    bio: "Replace this sample with the person leading the product experience, platform technology, security, and continuous improvements.",
    imageUrl: "",
    sortOrder: 30,
    isPublished: true,
  },
  {
    seedKey: "team-sample-4",
    name: "Team Member 4 (Sample)",
    role: "Community & Customer Success",
    bio: "Replace this sample with the team member supporting customers, listening to community feedback, and helping groups succeed.",
    imageUrl: "",
    sortOrder: 40,
    isPublished: true,
  },
];

async function seedTeam() {
  if (!process.env.MONGO_DB_URL) {
    throw new Error("MONGO_DB_URL is not configured");
  }

  await mongoose.connect(process.env.MONGO_DB_URL);
  const refresh = process.argv.includes("--refresh");
  const result = await TeamMember.bulkWrite(
    members.map((member) => ({
      updateOne: {
        filter: { seedKey: member.seedKey },
        update: refresh ? { $set: member } : { $setOnInsert: member },
        upsert: true,
      },
    }))
  );
  const totalMembers = await TeamMember.countDocuments({
    seedKey: { $in: members.map((member) => member.seedKey) },
  });

  console.log(`Sample team members ready: ${totalMembers}`);
  console.log(`New samples created: ${result.upsertedCount}`);
}

seedTeam()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
