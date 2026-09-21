/** @babel */

export default async function openExternal(url) {
  try {
    await lumine.shell.openExternal(url);
    return true;
  } catch (error) {
    lumine.notifications.addWarning("Unable to open the GitHub link.", {
      detail: error.message,
      dismissable: true,
    });
    return false;
  }
}
