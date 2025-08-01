"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropdownCategory = exports.NotificationStatus = exports.QueueStatus = exports.PaymentStatus = exports.PaymentMode = exports.DistributionType = exports.UserStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "super_admin";
    UserRole["ADMIN"] = "admin";
    UserRole["SALES"] = "sales";
    UserRole["CASHIER"] = "cashier";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var DistributionType;
(function (DistributionType) {
    DistributionType["LALAMOVE"] = "lalamove";
    DistributionType["LBC"] = "lbc";
    DistributionType["PICKUP"] = "pickup";
})(DistributionType || (exports.DistributionType = DistributionType = {}));
var PaymentMode;
(function (PaymentMode) {
    PaymentMode["GCASH"] = "gcash";
    PaymentMode["MAYA"] = "maya";
    PaymentMode["BANK_TRANSFER"] = "bank_transfer";
    PaymentMode["CREDIT_CARD"] = "credit_card";
    PaymentMode["CASH"] = "cash";
})(PaymentMode || (exports.PaymentMode = PaymentMode = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["UNPAID"] = "unpaid";
    PaymentStatus["PARTIAL"] = "partial";
    PaymentStatus["PAID"] = "paid";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var QueueStatus;
(function (QueueStatus) {
    QueueStatus["WAITING"] = "waiting";
    QueueStatus["SERVING"] = "serving";
    QueueStatus["PROCESSING"] = "processing";
    QueueStatus["COMPLETED"] = "completed";
    QueueStatus["CANCELLED"] = "cancelled";
})(QueueStatus || (exports.QueueStatus = QueueStatus = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["DELIVERED"] = "delivered";
    NotificationStatus["FAILED"] = "failed";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
var DropdownCategory;
(function (DropdownCategory) {
    DropdownCategory["GRADE_TYPE"] = "grade_type";
    DropdownCategory["LENS_TYPE"] = "lens_type";
})(DropdownCategory || (exports.DropdownCategory = DropdownCategory = {}));
//# sourceMappingURL=index.js.map