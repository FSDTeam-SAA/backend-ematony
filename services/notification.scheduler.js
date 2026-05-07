import { GroupMembership } from "../model/groupMembership.model.js";
import { Notification } from "../model/notification.model.js";
import { Payment } from "../model/payment.model.js";
import { SavingsGroup } from "../model/group.model.js";
import {
  createNotification,
  NotificationTemplates,
} from "./notification.service.js";

const HOUR = 60 * 60 * 1000;

let lastRunDay = null;

const runPaymentReminderSweep = async () => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (day < 23 || day > 30) return;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const groups = await SavingsGroup.find({
    status: { $in: ["active", "open"] },
  }).select("_id name");

  for (const group of groups) {
    const memberships = await GroupMembership.find({
      groupId: group._id,
      status: "active",
    }).select("userId");

    if (memberships.length === 0) continue;

    const memberIds = memberships.map((m) => m.userId);

    const paid = await Payment.find({
      groupId: group._id,
      type: "group_contribution",
      paymentStatus: { $in: ["complete", "succeeded"] },
      createdAt: { $gte: monthStart, $lte: monthEnd },
    }).select("userId");
    const paidIds = new Set(paid.map((p) => String(p.userId)));

    const unpaid = memberIds.filter((id) => !paidIds.has(String(id)));

    for (const userId of unpaid) {
      const existing = await Notification.findOne({
        userId,
        groupId: group._id,
        type: "payment_reminder",
        "metadata.month": month,
        "metadata.year": year,
      });
      if (existing) continue;

      const tpl = NotificationTemplates.paymentReminder({
        groupName: group.name,
      });
      await createNotification({
        userId,
        groupId: group._id,
        metadata: { month, year },
        ...tpl,
      });
    }
  }
};

const tick = async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (lastRunDay === today) return;
    lastRunDay = today;
    await runPaymentReminderSweep();
  } catch (err) {
    console.error("Payment reminder scheduler error:", err?.message || err);
  }
};

export const startNotificationScheduler = () => {
  // Run shortly after boot, then hourly. Self-debounces to once-per-day.
  setTimeout(tick, 30 * 1000);
  setInterval(tick, HOUR);
  console.log("[scheduler] Payment reminder scheduler started");
};

export const runPaymentRemindersNow = runPaymentReminderSweep;
