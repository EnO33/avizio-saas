/**
 * Barrel export des primitives UI. Utiliser :
 *   import { Button, Card, Stars } from "#/components/ui";
 *
 * Pour les types discriminés (ButtonVariant, Platform, ReviewStatus, etc.),
 * les importer depuis le fichier source pour garder l'autocomplétion nette.
 */
export { Avatar } from "./avatar";
export { Badge, type BadgeSize, type BadgeTone } from "./badge";
export { Button, type ButtonSize, type ButtonVariant } from "./button";
export { Card } from "./card";
export { ChoiceCard } from "./choice-card";
export { Divider } from "./divider";
export { Field } from "./field";
export { Input } from "./input";
export { Logo } from "./logo";
export { OtpInput } from "./otp-input";
export {
	PLATFORM_LABELS,
	type Platform,
	PlatformIcon,
} from "./platform-icon";
export { Stars } from "./stars";
export { type ReviewStatus, StatusBadge } from "./status-badge";
export { type TabItem, Tabs } from "./tabs";
export { Textarea } from "./textarea";
export { Toggle } from "./toggle";
