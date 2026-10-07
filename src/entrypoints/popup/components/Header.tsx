import type { AuthUser } from "../../../lib/messages";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function Header({ user }: { user: AuthUser }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[#e4e4e4] bg-white">
      <img src="/icon/32.png" alt="dosya" className="w-[22px] h-[22px]" />
      <div className="font-semibold text-sm flex-grow">Save to dosya</div>
      <div className="text-[11px] text-[#6b6b6b]">{user.email}</div>
      <div className="w-[26px] h-[26px] rounded-full bg-[#18181b] text-[#fafafa] flex items-center justify-center text-[11px] font-semibold">
        {initials(user.name)}
      </div>
    </div>
  );
}
