const profileKey = "p2p_profile_peerjs";

function loadProfile() {
  const raw = localStorage.getItem(profileKey);
  if (!raw) {
    const id = crypto.randomUUID();
    const profile = { id, name: "Device " + id.slice(0, 4) };
    localStorage.setItem(profileKey, JSON.stringify(profile));
    return profile;
  }
  return JSON.parse(raw);
}

function saveProfile(p) {
  localStorage.setItem(profileKey, JSON.stringify(p));
}

let profile = loadProfile();
