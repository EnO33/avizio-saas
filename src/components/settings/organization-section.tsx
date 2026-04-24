import { useOrganization } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { formatLongDateFr } from "#/lib/dates";
import { DeleteOrganizationDialog } from "./delete-organization-dialog";

const formSchema = z.object({
	name: z.string().trim().min(1, "Nom requis").max(100),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Section « Organisation » — éditer le nom (Clerk `organization.update`),
 * prévisualiser le monogramme généré pour la sidebar, afficher la date
 * de création, et poser la zone dangereuse pour supprimer l'org.
 *
 * Le slug est géré par Clerk (auto-généré à partir du nom) — pas
 * surfacé ici parce qu'on n'a pas d'URL multi-tenant dans l'app. Le
 * jour où on aura des routes du type `/org/{slug}/…`, on l'exposera.
 */
export function OrganizationSection() {
	const { organization } = useOrganization();
	const router = useRouter();
	const [savedAt, setSavedAt] = useState<Date | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: { name: organization?.name ?? "" },
	});

	if (!organization) return null;

	const isDirty = form.formState.isDirty;
	const isSubmitting = form.formState.isSubmitting;
	const rootError = form.formState.errors.root?.message;
	const currentName = form.watch("name");

	const handle = async (values: FormValues) => {
		form.clearErrors("root");
		// Clerk throw côté SDK. Wrap à la frontière (cf. CLAUDE.md §2).
		try {
			await organization.update({ name: values.name.trim() });
			form.reset(values);
			setSavedAt(new Date());
			await router.invalidate();
		} catch (err) {
			form.setError("root", {
				message:
					err instanceof Error && err.message
						? err.message
						: "Impossible d'enregistrer. Réessaie.",
			});
		}
	};

	const onCancel = () => form.reset();

	return (
		<section id="organization" data-settings-section>
			<Card padding={24}>
				<h2 className="mb-1 font-serif font-normal text-[22px]">
					Identité de l'organisation
				</h2>
				<p className="mb-5 text-[13px] text-ink-mute">
					Le nom apparaît dans le switcher de la sidebar et dans les emails
					envoyés par Avizio.
				</p>

				<form
					onSubmit={form.handleSubmit(handle)}
					className="flex flex-col gap-4"
					noValidate
				>
					<div className="flex items-center gap-4">
						<OrgMonogramPreview name={currentName || organization.name} />
						<div className="min-w-0 flex-1">
							<Field label="Nom de l'organisation">
								<Input
									{...form.register("name")}
									placeholder="Ex. La Maison Pléiade"
								/>
								{form.formState.errors.name?.message ? (
									<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
										{form.formState.errors.name.message}
									</p>
								) : null}
							</Field>
						</div>
					</div>

					<div className="text-[12px] text-ink-mute">
						Créée le {formatLongDateFr(organization.createdAt)}
					</div>

					{rootError ? (
						<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[13px] text-[oklch(0.4_0.12_25)]">
							{rootError}
						</p>
					) : null}

					<div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-end">
						{savedAt && !isDirty ? (
							<span className="text-[12px] text-green sm:self-center">
								Enregistré ✓
							</span>
						) : null}
						<Button
							variant="ghost"
							size="md"
							onClick={onCancel}
							disabled={!isDirty || isSubmitting}
							type="button"
						>
							Annuler
						</Button>
						<Button
							variant="accent"
							size="md"
							icon={<Check size={14} strokeWidth={1.75} />}
							disabled={!isDirty || isSubmitting}
							type="submit"
						>
							{isSubmitting ? "Enregistrement…" : "Enregistrer"}
						</Button>
					</div>
				</form>
			</Card>

			<DangerZone organizationName={organization.name} />
		</section>
	);
}

function OrgMonogramPreview({ name }: { name: string }) {
	const letter = name.trim().charAt(0).toLowerCase() || "·";
	return (
		<div
			aria-hidden="true"
			className="flex size-[56px] shrink-0 items-center justify-center rounded-[10px] bg-accent font-serif text-[32px] text-bg italic"
		>
			{letter}
		</div>
	);
}

function DangerZone({ organizationName }: { organizationName: string }) {
	const { organization } = useOrganization();
	const navigate = useNavigate();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const onConfirm = async () => {
		if (!organization) return;
		setBusy(true);
		setError(null);
		try {
			await organization.destroy();
			// Clerk clear la session d'org active ; le guard _authed va
			// renvoyer vers /onboarding au prochain load. On navigue
			// explicitement pour pas laisser l'user sur une page morte.
			await navigate({ to: "/onboarding", replace: true });
		} catch (err) {
			setBusy(false);
			setError(
				err instanceof Error && err.message
					? err.message
					: "Impossible de supprimer l'organisation. Réessaie.",
			);
		}
	};

	return (
		<>
			<Card
				padding={24}
				className="mt-6 border-[oklch(0.88_0.04_25)] bg-[oklch(0.98_0.01_25)]"
			>
				<h3 className="mb-1 font-serif font-normal text-[20px] text-[oklch(0.4_0.12_25)]">
					Zone dangereuse
				</h3>
				<p className="mb-4 text-[13px] text-[oklch(0.45_0.12_25)]">
					Supprimer l'organisation efface aussi tous ses établissements, avis et
					réponses liés. Action irréversible.
				</p>
				<Button
					variant="outline"
					size="md"
					onClick={() => setConfirmOpen(true)}
					className="border-[oklch(0.7_0.14_25)] text-[oklch(0.4_0.12_25)] hover:bg-[oklch(0.95_0.03_25)]"
				>
					Supprimer l'organisation
				</Button>
			</Card>

			{confirmOpen ? (
				<DeleteOrganizationDialog
					organizationName={organizationName}
					busy={busy}
					error={error}
					onCancel={() => {
						setConfirmOpen(false);
						setError(null);
					}}
					onConfirm={onConfirm}
				/>
			) : null}
		</>
	);
}
