// The page guests see on their phone when they join a site's Wi-Fi:
// /p/<site's address name>, e.g. /p/grand-anse-mall
//
// It gets the site's page and its splash ads from the server
// (/api/portal), and signing in saves the guest there. If the site has a
// running splash ad, it shows first ("before") or right after they
// connect ("after"), and its views and taps are counted.
//
// The controller sends guests to the server first (Omada: /omada/<name>,
// UniFi: /guest/s/<site>/), which sends them here with their phone's
// details signed in the address (?ctx=…&sig=…). Signing in hands those
// back, and the server lets that phone on through the controller.
// ?done=1: a whitelisted device the server already let on.
//
// Opened without those details (you trying the page while signed in to
// Foyer), it's a test: this browser gets a made-up MAC address, so
// trying twice counts as the same device coming back, and nobody is let
// on.
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ArrowLeft, LoaderCircle, SearchX, WifiOff, Wrench } from "lucide-react";
import useData from "../../useData";
import { api } from "../../api";
import { pickAd } from "../../ads";
import PortalPreview from "../PortalPreview";
import SplashAd from "../SplashAd";

function Notice({ icon, title, text }) {
  const Icon = icon;
  return (
    <div data-portal className="flex min-h-dvh items-center justify-center bg-[#f4f6fb] p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg shadow-black/5">
        <Icon size={40} className="mx-auto mb-3 text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{text}</p>
      </div>
    </div>
  );
}

function demoDeviceMac() {
  const make = () =>
    Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(),
    ).join(":");
  try {
    let mac = localStorage.getItem("foyer-demo-device");
    if (!mac) {
      mac = make();
      localStorage.setItem("foyer-demo-device", mac);
    }
    return mac;
  } catch {
    return make();
  }
}

// Counting a view or tap never gets in the guest's way
const count = (ad, kind) =>
  api(`/portal/ads/${ad.id}/${kind}`, { method: "POST" }).catch(() => {});

// The sign-in page with its splash ads. The ads are picked once, when
// the page opens.
// guest: { ctx, sig } from the controller, or null for a test
function Portal({ site, ads, guest, done }) {
  const [before] = useState(() => (done ? null : pickAd(ads, site.id, "before")));
  const [after] = useState(() => pickAd(ads, site.id, "after"));
  const [showing, setShowing] = useState(before); // the ad on screen, or null
  // Where the guest was going, for "Continue" (if the site doesn't say)
  const [next, setNext] = useState("");

  async function signIn(values) {
    try {
      const outcome = await api(`/portal/${site.slug}/signin`, {
        method: "POST",
        body: { ...values, ...(guest ?? { mac: demoDeviceMac() }) },
      });
      if (!outcome.error && after) setShowing(after);
      if (outcome.next) setNext(outcome.next);
      return outcome;
    } catch (err) {
      return { error: err.message };
    }
  }

  return (
    <>
      <PortalPreview
        site={site.redirectUrl || !next ? site : { ...site, redirectUrl: next }}
        page={done ? "success" : "signin"}
        fullPage
        onSignIn={signIn}
      />
      {showing && (
        <SplashAd
          key={showing.id + showing.when}
          ad={showing}
          onView={() => count(showing, "view")}
          onClick={() => count(showing, "click")}
          onDone={() => setShowing(null)}
        />
      )}
    </>
  );
}

export default function GuestPortal() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const guest = params.get("ctx") ? { ctx: params.get("ctx"), sig: params.get("sig") } : null;
  const { currentAdmin } = useData();
  // { site, ads }, "missing", "error" or null while loading
  const [page, setPage] = useState(null);

  useEffect(() => {
    let current = true;
    api(`/portal/${encodeURIComponent(slug)}`)
      .then((loaded) => current && setPage(loaded))
      .catch((err) => current && setPage(err.status === 404 ? "missing" : "error"));
    return () => {
      current = false;
    };
  }, [slug]);

  const site = page?.site;
  useEffect(() => {
    document.title = site ? `${site.name} Wi-Fi` : "Wi-Fi";
  }, [site]);

  return (
    <>
      {page === null ? (
        <div data-portal className="flex min-h-dvh items-center justify-center bg-[#f4f6fb]">
          <LoaderCircle size={32} className="animate-spin text-gray-400" aria-label="Loading" />
        </div>
      ) : page === "missing" ? (
        <Notice
          icon={SearchX}
          title="This Wi-Fi page doesn't exist"
          text="Check the address, or ask the staff for help connecting."
        />
      ) : page === "error" ? (
        <Notice
          icon={WifiOff}
          title="Wi-Fi"
          text="The sign-in page couldn't load. Wait a moment and reload the page."
        />
      ) : !site.active ? (
        <Notice
          icon={WifiOff}
          title={`${site.name} Wi-Fi`}
          text="Wi-Fi sign-in isn't available right now. Please ask the staff."
        />
      ) : site.maintenance?.mode === "notice" ? (
        <Notice
          icon={Wrench}
          title={`${site.name} Wi-Fi is under maintenance`}
          text={site.maintenance.message || "We're working on the Wi-Fi. Please try again a little later."}
        />
      ) : (
        <Portal
          key={site.id}
          site={site}
          ads={page.ads}
          guest={guest}
          done={params.get("done") === "1"}
        />
      )}

      {/* Only people signed in to Foyer see this, to get back after
          trying the page. A full page load, so the sign-in just made
          shows on the Guests page and in the reports. */}
      {currentAdmin && (
        <a
          href={site && currentAdmin.role !== "client" ? `/sites/${site.id}` : "/"}
          className="fixed top-3 left-3 z-50 flex items-center gap-1.5 rounded-full bg-gray-900/80 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-gray-900"
        >
          <ArrowLeft size={14} />
          Back to Foyer
        </a>
      )}
    </>
  );
}
