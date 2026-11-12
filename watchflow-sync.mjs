const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fields = (base, local, remote) => {
  const result = {...remote};
  for (const key of Object.keys(local)) {
    if (!same(local[key], base[key])) result[key] = local[key];
  }
  return result;
};
function records(base, local, remote, resolve) {
  const byId = list => new Map(list.map(item => [item.id,item]));
  const original = byId(base), mine = byId(local), theirs = byId(remote);
  return [...new Set([...theirs.keys(),...mine.keys()])].flatMap(id => {
    const before = original.get(id), ours = mine.get(id), other = theirs.get(id);
    if (same(ours,before)) return other ? [other] : [];
    if (!ours) return []; // A deletion relative to our last synced copy.
    if (same(other,before)) return [ours];
    if (!other) return before ? [] : [ours]; // Respect a deletion on the other device.
    return [resolve(before,ours,other)];
  });
}
function mergeTitle(before, local, remote) {
  if (!before) {
    const localTime = Date.parse(local.updated)||0, remoteTime = Date.parse(remote.updated)||0;
    const newer = localTime > remoteTime ? local : remote;
    const bookmark = local.season > remote.season ||
      (local.season === remote.season && local.progress > remote.progress) ? local : remote;
    return {...newer,season:bookmark.season,progress:bookmark.progress};
  }
  const title = fields(before,local,remote);
  // Keep the image paired with its URL if another device changes the source.
  if (local.poster !== before.poster) title.cover = local.cover;
  else if (remote.poster !== before.poster) title.cover = remote.cover;
  else if (!before.cover && local.updated === before.updated && remote.cover) title.cover = remote.cover;
  if (local.season !== before.season || local.progress !== before.progress) {
    // A season and its episode number are a single bookmark.
    title.season = local.season;
    title.progress = local.progress;
  }
  if (remote.updated > title.updated) title.updated = remote.updated;
  if (remote.synced > title.synced) title.synced = remote.synced;
  return title;
}
export function mergeWatchflow(base, local, remote, empty) {
  if (!remote) return local;
  const previous = base || empty;
  const titles = records(previous.titles,local.titles,remote.titles,mergeTitle);
  const ids = new Set(titles.map(item => item.id));
  const events = records(previous.events,local.events,remote.events,(before,ours,theirs) =>
    before ? (ours.automatic && theirs.automatic ? theirs : ours) : theirs
  ).filter(e => ids.has(e.titleId));
  const read = {...remote.read};
  for (const [id,time] of Object.entries(local.read)) {
    if (!read[id] || read[id] < time) read[id] = time;
  }
  for (const [id,time] of Object.entries(previous.read)) {
    if (!Object.hasOwn(local.read,id) && read[id] === time) delete read[id];
  }
  return {version:1,titles,events,read,settings:fields(previous.settings,local.settings,remote.settings)};
}
export async function syncWatchflow({client, snapshot, apply, normalize, empty}) {
  let reply = await client.watchflowGet();
  for (let attempt=0; attempt<3; attempt++) {
    const remote = reply.watchflow;
    if (!remote || typeof remote.revision !== 'string') throw Error('Google ไม่ส่งข้อมูล WatchFlow');
    const theirs = remote.data ? normalize(remote.data) : null;
    const local = snapshot();
    if (!local) return;
    const merged = normalize(mergeWatchflow(local.base,local.state,theirs,empty));
    const pending = !same(merged,theirs||empty);
    if (!pending) {
      apply(merged,theirs||empty);
      return;
    }
    reply = await client.watchflowSave(remote.revision,merged);
    if (reply.conflict) continue;
    if (!reply.watchflow?.data) throw Error('Google ยังไม่ยืนยันการบันทึก');
    const saved = normalize(reply.watchflow.data), latest = snapshot();
    if (!latest) return;
    const next = normalize(mergeWatchflow(local.state,latest.state,saved,empty));
    apply(next,saved);
    return !same(next,saved);
  }
  throw Error('มีการแก้ไขจากหลายเครื่อง กำลังรอซิงก์อีกครั้ง');
}
