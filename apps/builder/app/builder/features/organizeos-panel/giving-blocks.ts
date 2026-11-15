import { organizeosNamespace } from "./insert-organizeos-block";

/**
 * The Giving blocks in the builder (OrganizeOS builder donations spec
 * 2026-11-13, section 7; plan F1): their component names, and the pure parts
 * of their Settings rows.
 */

export const donationFormComponent = `${organizeosNamespace}:DonationForm`;
export const goalProgressComponent = `${organizeosNamespace}:GoalProgress`;
