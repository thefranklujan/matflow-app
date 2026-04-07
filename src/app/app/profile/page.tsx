import ProfileForm from "./ProfileForm";
import LeaveGymButton from "./LeaveGymButton";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage() {
  return (
    <div>
      <ProfileForm />
      <LeaveGymButton />
    </div>
  );
}
