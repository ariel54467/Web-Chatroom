import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Busy, IconButton, Modal } from "./ui";
import { describeError } from "../services/chatApi";
import { disablePush, enablePush, pushSupport, syncPush } from "../services/push";

export function NotificationToggle({ onError }) {
  const support = pushSupport();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    let active = true;
    syncPush().then(enabled => { if (active) setOn(enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (support === "unsupported") return null;

  async function toggle() {
    if (support === "install") { setHelp(true); return; }
    setBusy(true);
    try {
      if (on) { await disablePush(); setOn(false); }
      else { await enablePush(); setOn(true); }
    } catch (e) { onError(describeError(e)); } finally { setBusy(false); }
  }
  return <>
    <IconButton className={`icon-button ${on ? "active" : ""}`} label={on ? "Turn off notifications" : "Turn on notifications"}
      disabled={busy} onClick={toggle}>{busy ? <Busy /> : on ? <BellRing size={18} /> : <Bell size={18} />}</IconButton>
    {help && <Modal title="Notifications on iPhone" onClose={() => setHelp(false)}>
      <ol className="install-steps">
        <li>In Safari, tap the <strong>Share</strong> button.</li>
        <li>Choose <strong>Add to Home Screen</strong>.</li>
        <li>Open Chatterly from your Home Screen, sign in, and tap the bell again.</li>
      </ol>
      <p className="muted">Needs iOS 16.4 or newer.</p>
    </Modal>}
  </>;
}
