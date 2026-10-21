// The page guests see on their phone when they join a site's Wi-Fi:
// /p/<site's address name>, e.g. /p/grand-anse-mall
//
// If the site has a running splash ad, it shows first ("before") or
// right after they connect ("after"), and its views and taps are
// counted.
//
// FOR NOW (no server yet): signing in checks the form and voucher and
// saves the guest here, so they show up on the Guests page and in the
// reports. Once the server is built, the controller sends guests here
// (Omada: /omada/<name>, UniFi: /guest/s/<site>/) and signing in also
// lets their phone on through the controller.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, SearchX, WifiOff } from "lucide-react";
import useData from "../../useData";
import { pickAd } from "../../ads";
import PortalPreview from "../PortalPreview";
import SplashAd from "../SplashAd";

function Notice({ icon, title, text }) {
  const Icon = icon;
  return (
    <div
      data-portal
      className="flex min-h-dvh items-center justify-center bg-[#f4f6fb] p-6"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg shadow-black/5">
        <Icon size={40} className="mx-auto mb-3 text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{text}</p>
      </div>
    </div>
  );
}

// The sign-in page with its splash ads. The ads are picked once, when
// the page opens, so turning one on or off in another tab doesn't
// change what this guest sees.
function Portal({ site }) {
  const { ads, recordSignIn, recordAdView, recordAdClick } = useData();
  const [before] = useState(() => pickAd(ads, site.id, "before"));
  const [after] = useState(() => pickAd(ads, site.id, "after"));
  const [showing, setShowing] = useState(before); // the ad on screen, or null

  async function signIn(values) {
    const outcome = recordSignIn(site, values);
    if (!outcome.error && after) setShowing(after);
    return outcome;
  }

  return (
    <>
      <PortalPreview site={site} fullPage onSignIn={signIn} />
      {showing && (
        <SplashAd
          key={showing.id + showing.when}
          ad={showing}
          onView={() => recordAdView(showing.id)}
          onClick={() => recordAdClick(showing.id)}
          onDone={() => setShowing(null)}
        />
      )}
    </>
  );
}

export default function GuestPortal() {
  const { slug } = useParams();
  const { sites, currentAdmin } = useData();
  const site = sites.find((s) => s.slug === slug);

  useEffect(() => {
    document.title = site ? `${site.name} Wi-Fi` : "Wi-Fi";
  }, [site]);

  return (
    <>
      {!site ? (
        <Notice
          icon={SearchX}
          title="This Wi-Fi page doesn't exist"
          text="Check the address, or ask the staff for help connecting."
        />
      ) : !site.active ? (
        <Notice
          icon={WifiOff}
          title={`${site.name} Wi-Fi`}
          text="Wi-Fi sign-in isn't available right now. Please ask the staff."
        />
      ) : (
        <Portal key={site.id} site={site} />
      )}

      {/* Only admins see this, to get back after trying the page */}
      {currentAdmin && (
        <Link
          to={site ? `/sites/${site.id}` : "/sites"}
          className="fixed top-3 left-3 z-50 flex items-center gap-1.5 rounded-full bg-gray-900/80 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-gray-900"
        >
          <ArrowLeft size={14} />
          Back to Foyer
        </Link>
      )}
    </>
  );
}