/** Keep save confirmation visible while a form navigates to its destination. */
export function announceSaveComplete(message: string) {
  window.dispatchEvent(new CustomEvent("froskolin:save-complete", { detail: message }));
}
