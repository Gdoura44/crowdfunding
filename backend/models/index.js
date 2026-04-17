/**
 * Loads all Mongoose models (aligné sur `conception/mongo db/*.txt`).
 * Import this once at process startup so every schema is registered.
 */
require("./User");
require("./Project");
require("./Investment");
require("./Transaction");
require("./Notification");
require("./Report");
require("./Payout");
require("./AuditLog");
require("./FailedWorkflowEvent");
require("./FailedCancellationEvent");
require("./FailedRefundEvent");
require("./FailedPayoutEvent");
