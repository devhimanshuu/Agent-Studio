"use client";

import React, { useEffect, useRef, useState } from "react";
import { Users, Lock } from "lucide-react";

const CURSOR_COLORS = [
  "#818cf8", // indigo
  "#f472b6", // pink
  "#34d399", // emerald
  "#fbbf24", // amber
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#fb923c", // orange
  "#2dd4bf", // teal
];

export interface PeerPresence {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  viewOffset: { x: number; y: number } | null;
  zoom: number;
  editingNodeId: string | null;
  lastSeen: number;
}

interface CollaborationOverlayProps {
  /** The canvas container element for coordinate transforms. */
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Current viewport transform from React Flow. */
  viewport: { x: number; y: number; zoom: number };
}

/**
 * Generates a random user ID and color for this session.
 */
function useSessionIdentity() {
  const [identity] = useState(() => {
    const id = `user_${Math.random().toString(36).slice(2, 8)}`;
    const name = `User ${Math.floor(Math.random() * 999)}`;
    const colorIndex = Math.floor(Math.random() * CURSOR_COLORS.length);
    return { id, name, color: CURSOR_COLORS[colorIndex] };
  });
  return identity;
}

/**
 * Multiplayer Collaboration overlay:
 * Shows live cursors, presence indicators, and lock indicators.
 * Uses BroadcastChannel for cross-tab communication (demo mode).
 */
export function CollaborationOverlay({
  canvasContainerRef,
  viewport,
}: CollaborationOverlayProps) {
  const identity = useSessionIdentity();
  const [peers, setPeers] = useState<Map<string, PeerPresence>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const containerRectRef = useRef<DOMRect | null>(null);

  // Initialize BroadcastChannel for cross-tab collaboration
  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel("agent-studio-collab");
    } catch {
      // BroadcastChannel not supported — graceful degradation
      return;
    }

    const channel = channelRef.current;

    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "cursor" && msg.senderId !== identity.id) {
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(msg.senderId, {
            id: msg.senderId,
            name: msg.name,
            color: msg.color,
            cursor: msg.cursor,
            viewOffset: msg.viewOffset ?? null,
            zoom: msg.zoom ?? 1,
            editingNodeId: msg.editingNodeId ?? null,
            lastSeen: Date.now(),
          });
          return next;
        });
      }
      if (msg.type === "leave" && msg.senderId !== identity.id) {
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(msg.senderId);
          return next;
        });
      }
    };

    // Broadcast presence on mount
    channel.postMessage({
      type: "join",
      senderId: identity.id,
      name: identity.name,
      color: identity.color,
    });

    // Broadcast leave on unmount
    return () => {
      channel.postMessage({ type: "leave", senderId: identity.id });
      channel.close();
    };
  }, [identity]);

  // Track mouse movement and broadcast cursor position
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !channelRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      containerRectRef.current = container.getBoundingClientRect();
      const rect = containerRectRef.current;

      // Convert screen coords to canvas coords
      const canvasX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const canvasY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

      channelRef.current?.postMessage({
        type: "cursor",
        senderId: identity.id,
        name: identity.name,
        color: identity.color,
        cursor: { x: canvasX, y: canvasY },
        viewOffset: { x: viewport.x, y: viewport.y },
        zoom: viewport.zoom,
      });
    };

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [canvasContainerRef, viewport, identity]);

  // Prune stale peers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPeers((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [id, peer] of next) {
          if (now - peer.lastSeen > 10000) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const peerList = Array.from(peers.values());

  if (peerList.length === 0) return null;

  return (
    <>
      {/* Remote cursors */}
      {peerList.map((peer) => {
        if (!peer.cursor) return null;
        // Convert canvas coords back to screen coords
        const screenX = peer.cursor.x * peer.zoom + peer.viewOffset!.x;
        const screenY = peer.cursor.y * peer.zoom + peer.viewOffset!.y;

        return (
          <div
            key={peer.id}
            className="pointer-events-none absolute z-40 transition-all duration-100 ease-out"
            style={{ left: screenX, top: screenY }}
          >
            {/* Cursor arrow */}
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.5))` }}
            >
              <path
                d="M1 1L1 15L5.5 11L10 19L13 17.5L8.5 10L14 9L1 1Z"
                fill={peer.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            {/* Name tag */}
            <div
              className="absolute left-4 top-3 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap shadow-md"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
              {peer.editingNodeId && (
                <span className="ml-1 opacity-70">
                  <Lock className="h-2 w-2 inline" /> editing {peer.editingNodeId}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Presence indicator bar */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-[#0a0a14]/95 backdrop-blur-sm px-2 py-1">
          <Users className="h-3 w-3 text-indigo-400" />
          <span className="text-[9px] font-bold text-indigo-300">
            {peerList.length + 1} online
          </span>
          <div className="flex -space-x-1">
            {/* Self indicator */}
            <div
              className="h-4 w-4 rounded-full border-2 border-[#0a0a14] flex items-center justify-center"
              style={{ backgroundColor: identity.color }}
              title={`${identity.name} (you)`}
            >
              <span className="text-[6px] font-bold text-white">Y</span>
            </div>
            {peerList.map((peer) => (
              <div
                key={peer.id}
                className="h-4 w-4 rounded-full border-2 border-[#0a0a14] flex items-center justify-center"
                style={{ backgroundColor: peer.color }}
                title={peer.name}
              >
                <span className="text-[6px] font-bold text-white">
                  {peer.name.charAt(peer.name.length - 1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
