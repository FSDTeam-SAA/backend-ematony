import "dotenv/config";
import mongoose from "mongoose";
import { Testimonial } from "../model/testimonial.model.js";

const drafts = [
  {
    seedKey: "testimonial-draft-1",
    name: "Family Circle Member (Sample)",
    location: "Lagos, Nigeria",
    review: "The clear contribution schedule makes it easier for everyone in our circle to understand what is due and when the next payout is coming.",
    rating: 5,
    sortOrder: 10,
    isPublished: true,
  },
  {
    seedKey: "testimonial-draft-2",
    name: "Savings Group Organiser (Sample)",
    location: "Abuja, Nigeria",
    review: "Keeping payments, member progress, and payout order in one place gives our group a much clearer way to stay organized.",
    rating: 5,
    sortOrder: 20,
    isPublished: true,
  },
  {
    seedKey: "testimonial-draft-3",
    name: "Diaspora Group Member (Sample)",
    location: "London, United Kingdom",
    review: "Ajo Family helps our relatives in different locations follow the same savings plan without relying on scattered messages.",
    rating: 5,
    sortOrder: 30,
    isPublished: true,
  },
  {
    seedKey: "testimonial-draft-4",
    name: "Community Saver (Sample)",
    location: "Manchester, United Kingdom",
    review: "The notifications and visible group progress help us keep the contribution rhythm moving and reduce unnecessary confusion.",
    rating: 5,
    sortOrder: 40,
    isPublished: true,
  },
  {
    seedKey: "testimonial-draft-5",
    name: "Circle Coordinator (Sample)",
    location: "Toronto, Canada",
    review: "It is reassuring to have a shared view of the circle so members can see the plan, understand their turn, and stay informed.",
    rating: 5,
    sortOrder: 50,
    isPublished: true,
  },
];

async function seedTestimonials() {
  if (!process.env.MONGO_DB_URL) {
    throw new Error("MONGO_DB_URL is not configured");
  }

  await mongoose.connect(process.env.MONGO_DB_URL);
  const refresh = process.argv.includes("--refresh");
  const result = await Testimonial.bulkWrite(
    drafts.map((draft) => ({
      updateOne: {
        filter: { seedKey: draft.seedKey },
        update: refresh ? { $set: draft } : { $setOnInsert: draft },
        upsert: true,
      },
    }))
  );
  const totalDrafts = await Testimonial.countDocuments({
    seedKey: { $in: drafts.map((draft) => draft.seedKey) },
  });

  console.log(`Sample testimonials ready: ${totalDrafts}`);
  console.log(`New samples created: ${result.upsertedCount}`);
}

seedTestimonials()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
