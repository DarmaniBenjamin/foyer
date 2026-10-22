// The whole screen while Foyer starts: the Wi-Fi loader, or why it can't reach
// the server with a Try again button
import { WifiOff } from "lucide-react";
import WifiLoader from "./WifiLoader";
import useData from "../useData";
import { secondaryButton } from "./formStyles";

export default function Loading() {
  const { status, startError, retry } = useData();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {status === "error" ? (
        <>
          <WifiOff size={36} className="text-muted" />
          <p className="max-w-sm text-sm text-muted">{startError}</p>
          <button type="button" onClick={retry} className={secondaryButton}>
            Try again
          </button>
        </>
      ) : (
        <WifiLoader size={56} className="text-brand" label="Loading" />
      )}
    </div>
  );
}
