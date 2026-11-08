import WaiverSignForm from "@/components/WaiverSignForm";

/**
 * Waiver signing for students (web and the native shell). It replaces the
 * legacy /members/waiver page removed by the Phase 0 hotfix; the API it uses
 * (/api/members/waiver) is scoped to the session's academy and member.
 */
export default function StudentWaiverPage() {
  return <WaiverSignForm />;
}
