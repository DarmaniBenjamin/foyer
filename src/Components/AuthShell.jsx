// The frame for the sign-in page: the logo and a card in the middle of
// the screen, over the app's glow
import { Wifi } from "lucide-react";
import { APP_NAME } from "../brand";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-brand/30">
          <Wifi size={24} />
        </span>
        <span className="text-2xl font-semibold">{APP_NAME}</span>
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-6 shadow-xl shadow-black/5 sm:p-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-xs text-muted">Guest Wi-Fi for Protonic Solutions clients</p>
    </div>
  );
}