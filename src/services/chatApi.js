import { supabase, projectUrl, publicKey } from "./supabase";

export async function rpc(name, args = {}) {
  if (!supabase) throw new Error("Chat service is not configured.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export function describeError(error) {
  if (error?.message === "Failed to fetch") return "Connection lost. Check your internet connection and try again.";
  if (error?.code === "42P01" || error?.code === "PGRST202") return "The chat database is not ready yet.";
  if (error?.status === 413) return "This file is too large.";
  return error?.message || "Something went wrong. Please try again.";
}

export function validateFile(file, avatar = false) {
  const images = ["image/jpeg", "image/png", "image/webp"];
  const types = avatar ? images : [...images, "image/gif", "video/mp4"];
  if (!types.includes(file.type)) throw new Error(avatar
    ? "Choose a JPG, PNG, or WebP image."
    : "Choose a JPG, PNG, WebP, GIF, or MP4 file.");
  const max = avatar ? 2 : file.type === "video/mp4" ? 10 : 5;
  if (!file.size || file.size > max * 1024 * 1024) throw new Error(`The file must be smaller than ${max} MB.`);
  return file.type === "video/mp4" ? "video" : file.type === "image/gif" ? "gif" : "image";
}

export function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "attachment";
}

// XHR exposes upload progress and cancellation, which fetch does not.
export async function uploadFile(bucket, path, file, { signal, onProgress } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again to upload.");
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const done = () => signal?.removeEventListener("abort", abort);
    request.open("POST", `${projectUrl}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
    request.setRequestHeader("apikey", publicKey);
    request.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("x-upsert", "false");
    request.timeout = 120000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    request.onload = () => {
      done();
      if (request.status >= 200 && request.status < 300) resolve(path);
      else {
        let message = "Upload failed. Please try again.";
        try { message = JSON.parse(request.responseText).message || message; } catch { /* Non-JSON network response. */ }
        reject(new Error(message));
      }
    };
    request.onerror = () => { done(); reject(new Error("Upload failed. Check your connection.")); };
    request.ontimeout = () => { done(); reject(new Error("Upload timed out. Please try again.")); };
    request.onabort = () => { done(); reject(new DOMException("Cancelled", "AbortError")); };
    request.send(file);
  });
}

export async function removeFile(bucket, path) {
  if (!path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function mediaUrl(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
