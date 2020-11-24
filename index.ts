import * as path from "path";

// input types
type MapEntry = { name: string, version: string, location: string };
type ResolutionEntry = { key: string, version: string };

// local types
type PackageUniqKey = { value: string, type: "packageUniqKey" };
type PackageName = { value: string, type: "packageName" };
type PackageVersion = { value: string, type: "packageVersion" };
type PackageLocation = { value: string, type: "packageLocation" };
type PackageRange = { value: string, type: "packageRange" };

// output types
type GraphLink = { source: string, target: string, type: "peer" | "regular" };
type Graph = { nodes: string[] , links: GraphLink[] };

const map: MapEntry[] = require(path.join(process.cwd(), "map.json"));
const resolutionMap: ResolutionEntry[] = require(path.join(process.cwd(), "resolutions.json"));

function makePackageUniqKey(name: PackageName, version: PackageVersion): PackageUniqKey {
  return { value: `${name.value}@${version.value}`, type: "packageUniqKey" };
}

function resolve(resolutionMap: ResolutionEntry[], name: PackageName, range: PackageRange): PackageUniqKey {
  const resolved : PackageVersion = { value: resolutionMap.filter(v => v.key === `${name.value}@${range.value}`)[0].version, type: "packageVersion" };
  const result = makePackageUniqKey(name, resolved);
  return result;
}

function getDependencies(resolutionMap: ResolutionEntry[], location: PackageLocation): PackageUniqKey[] {
  const pj: { dependencies?: { [name: string]: string }, devDependencies?: { [name: string ] : string }} = require(location.value);
  const is_local = location.value.startsWith(process.cwd());
  const deps : { [name: string] : string } = is_local ? { ...pj.dependencies, ...pj.devDependencies } : pj.dependencies || {};
  const result = Object.keys(deps).map(o => resolve(resolutionMap, {value: o, type: "packageName"}, { value: deps[o], type: "packageRange"}));
  return result;
}

function getPeerDependencies(location: PackageLocation): PackageName[] {
  const is_local = location.value.startsWith(process.cwd());
  if (is_local) {
    // Local packages should fullfill its own peerDependencies.
    return [];
  }
  const pj: { peerDependencies?: { [name: string]: string }, peerDependenciesMeta?: { [name: string]: any } } = require(location.value);
  const pd = {...(pj.peerDependencies || {}), ...(pj.peerDependenciesMeta || {})};
  const result : PackageName[] = Object.keys(pd).map(o => ({ value: o, type: "packageName" }));
  return result
}

function makePackageName(name: string): PackageName {
  return { value: name, type: "packageName" };
}

function makePackageVersion(version: string): PackageVersion {
  return { value: version, type: "packageVersion" };
}

function makePackageLocation(location: string): PackageLocation {
  return { value: location, type: "packageLocation" };
}

function makeRegularLink(source: PackageUniqKey, target: PackageUniqKey): { source: string, target: string, type: "regular" } {
  return { source: source.value, target: target.value, type: "regular" };
}

function makePeerLink(source: PackageUniqKey, target: PackageName): { source: string, target: string, type: "peer" } {
  return { source: source.value, target: target.value, type: "peer" };
}

function makePackageManifest(name: string, version: string, location: string): { key: PackageUniqKey, location: PackageLocation } {
  return { key: makePackageUniqKey(makePackageName(name), makePackageVersion(version)), location: makePackageLocation(location)}
}

function getAllDependencies(resolutions: ResolutionEntry[], key: PackageUniqKey, location: PackageLocation): GraphLink[] {
  const result = [...getDependencies(resolutions, location).map(v => makeRegularLink(key, v)), ...getPeerDependencies(location).map(v => makePeerLink(key, v))];
  return result;
}

function getAllRootDependencies(packages: { key: PackageUniqKey, location: PackageLocation }[]): GraphLink[] {
  const result = packages.filter(p => p.location.value.startsWith(process.cwd())).map(p => makeRegularLink({ value: "root", type: "packageUniqKey"}, p.key));
  return result
}

function getGraph(map: MapEntry[], resolutions: ResolutionEntry[]): Graph {
  const all_packages = map.map(o => makePackageManifest(o.name, o.version, o.location));
  const links = all_packages.map(p => getAllDependencies(resolutions, p.key, p.location)).reduce((p,n) => [...p, ...n], []);

  const rootDependencies = getAllRootDependencies(all_packages);
  return { nodes: all_packages.map(o => o.key.value).concat(["root"]), links: links.concat(rootDependencies) };
}

console.log(JSON.stringify(getGraph(map, resolutionMap), undefined, 2));


