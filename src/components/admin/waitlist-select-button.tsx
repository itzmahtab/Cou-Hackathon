import { selectFromWaitlistAction } from "@/app/admin/actions/selection";
import { ActionForm } from "@/components/admin/action-form";

/** "Select & send selection email" for one waiting team. Nothing is sent until it is pressed. */
export function WaitlistSelectButton({ teamId, teamName, members }: { teamId: string; teamName: string; members: number }) {
  return (
    <ActionForm
      action={selectFromWaitlistAction}
      submitLabel="Select & send selection email"
      inline
      confirm={`Select ${teamName} for the final and email the selection email to its ${members} member${members === 1 ? "" : "s"} now?`}
    >
      <input type="hidden" name="teamId" value={teamId} />
    </ActionForm>
  );
}
