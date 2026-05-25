import { GroupMembership } from "../model/groupMembership.model.js";
import { Notification } from "../model/notification.model.js";
import { Payment } from "../model/payment.model.js";
import { SavingsGroup } from "../model/group.model.js";
import {
  createNotification,
  NotificationTemplates,
} from "./notification.service.js";
import { getContributionPeriod } from "../utils/groupPolicy.js";

const HOUR = 60 * 60 * 1000;

let lastRunDay = null;

const runPaymentReminderSweep = async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const groups = await SavingsGroup.find({
    status: { $in: ["active", "open"] },
  }).select(
    "_id name contributionFrequency lateFeePercent gracePeriodHours startDate createdAt"
  );

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
      periodStart: getContributionPeriod(group, now).periodStart,
    }).select("userId");
    const paidIds = new Set(paid.map((p) => String(p.userId)));

    const unpaid = memberIds.filter((id) => !paidIds.has(String(id)));
    const period = getContributionPeriod(group, now);
    const frequencyLabel =
      group.contributionFrequency === "biweekly"
        ? "Bi-Weekly"
        : `${group.contributionFrequency[0].toUpperCase()}${group.contributionFrequency.slice(1)}`;

    for (const userId of unpaid) {
      if (now >= period.reminderDate && now <= period.dueDate) {
        const existingReminder = await Notification.findOne({
          userId,
          groupId: group._id,
          type: "payment_reminder",
          "metadata.periodStart": period.periodStart,
        });
        if (!existingReminder) {
          const tpl = NotificationTemplates.paymentReminder({
            groupName: group.name,
            frequencyLabel,
          });
          await createNotification({
            userId,
            groupId: group._id,
            metadata: { month, year, periodStart: period.periodStart },
            ...tpl,
          });
        }
      }

      if (now > period.dueDate && now <= period.graceDeadline) {
        const existingLate = await Notification.findOne({
          userId,
          groupId: group._id,
          type: "payment_late",
          "metadata.periodStart": period.periodStart,
        });
        if (!existingLate) {
          const tpl = NotificationTemplates.paymentLate({
            groupName: group.name,
            graceHours: group.gracePeriodHours || 24,
            lateFeePercent: group.lateFeePercent || 7.5,
          });
          await createNotification({
            userId,
            groupId: group._id,
            metadata: { month, year, periodStart: period.periodStart },
            ...tpl,
          });
        }
      }
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
