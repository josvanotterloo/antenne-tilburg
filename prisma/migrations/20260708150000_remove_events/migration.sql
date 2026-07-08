-- Remove the events feature entirely. Notices cover one-off announcements.

-- DropTable (must come before the enum it depends on)
DROP TABLE "Event";

-- DropEnum
DROP TYPE "EventStatus";
