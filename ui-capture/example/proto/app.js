(() => {
    try {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    } catch (_) { }

    // Home Manager Service
    const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const UserManager = (() => {
        const KEY = 'thynco_user_v1';
        const fallback = { id: 'm1', name: 'Alex Johnson', email: 'alex.johnson@thynco.ai', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200' };

        const load = () => {
            try {
                const raw = localStorage.getItem(KEY);
                if (!raw) return fallback;
                const parsed = JSON.parse(raw);
                if (!parsed?.id) return fallback;
                return { ...fallback, ...parsed };
            } catch (_) {
                return fallback;
            }
        };

        const save = (user) => {
            try {
                const next = { ...load(), ...(user || {}) };
                localStorage.setItem(KEY, JSON.stringify(next));
                return next;
            } catch (_) {
                return load();
            }
        };

        return {
            get: () => load(),
            set: (user) => save(user)
        };
    })();

    const Permissions = (() => {
        const ROLES = ['owner', 'admin', 'member', 'guest'];
        const normalizeRole = (role) => {
            const r = (role || '').toString().toLowerCase().trim();
            return ROLES.includes(r) ? r : 'guest';
        };

        const can = (role, action) => {
            const r = normalizeRole(role);
            if (r === 'owner') return true;
            if (r === 'admin') {
                return [
                    'home:edit',
                    'room:manage',
                    'member:invite',
                    'member:remove',
                    'member:role',
                    'device:add',
                    'device:remove',
                    'device:update'
                ].includes(action);
            }
            if (r === 'member') {
                return [
                    'device:update'
                ].includes(action);
            }
            if (r === 'guest') {
                return [
                    'device:update'
                ].includes(action);
            }
            return false;
        };

        const labelForRole = (role) => {
            const r = normalizeRole(role);
            if (r === 'owner') return 'Owner';
            if (r === 'admin') return 'Admin';
            if (r === 'member') return 'Member';
            return 'Guest';
        };

        return { ROLES, normalizeRole, can, labelForRole };
    })();

    window.UserManager = UserManager;
    window.Permissions = Permissions;

    const applyUserProfileToDom = () => {
        const me = UserManager.get();
        document.querySelectorAll('[data-user-name]').forEach(el => {
            el.textContent = me.name || '—';
        });
        document.querySelectorAll('[data-user-email]').forEach(el => {
            el.textContent = me.email || '—';
        });
        document.querySelectorAll('[data-user-avatar]').forEach(img => {
            if (!img) return;
            if (me.avatarUrl) img.src = me.avatarUrl;
            img.alt = me.name || 'User';
        });
    };

    const bindProfileEditForm = () => {
        const form = document.querySelector('[data-profile-form]');
        if (!form) return;

        const nameInput = form.querySelector('[data-profile-name]');
        const emailInput = form.querySelector('[data-profile-email]');
        const avatarInput = form.querySelector('[data-profile-avatar]');
        const me = UserManager.get();

        if (nameInput) nameInput.value = me.name || '';
        if (emailInput) emailInput.value = me.email || '';
        if (avatarInput) avatarInput.value = me.avatarUrl || '';

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const next = UserManager.set({
                name: (nameInput?.value || '').trim(),
                email: (emailInput?.value || '').trim(),
                avatarUrl: (avatarInput?.value || '').trim()
            });

            try {
                const homes = window.HomeManager?.getHomes?.() || [];
                homes.forEach(h => {
                    const members = Array.isArray(h.members) ? h.members.map(m => {
                        if (m?.id && m.id === next.id) return { ...m, name: next.name || m.name };
                        return m;
                    }) : h.members;
                    window.HomeManager?.upsertHome?.({ id: h.id, members });
                });
            } catch (_) { }

            applyUserProfileToDom();
            location.href = 'user.html';
        });
    };

    const bindSignOutButtons = () => {
        document.querySelectorAll('[data-sign-out]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Sign out?')) return;
                try {
                    localStorage.removeItem('thynco_user_v1');
                    localStorage.removeItem('thynco_actor_member_v1');
                    localStorage.removeItem('thynco_active_home_v1');
                    localStorage.removeItem('thynco_assistant_messages_v2');
                } catch (_) { }
                location.href = 'index.html';
            });
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        applyUserProfileToDom();
        bindProfileEditForm();
        bindSignOutButtons();
    });

    const HomeManager = (() => {
        const HOMES_KEY = 'thynco_homes_v2';
        const ACTIVE_HOME_KEY = 'thynco_active_home_v1';
        const ACTOR_KEY = 'thynco_actor_member_v1';
        const eventListeners = new Map();

        const defaultHomes = [
            {
                id: 'aurora',
                name: 'Aurora Residence',
                lat: 37.789,
                lng: -122.401,
                rooms: [
                    { id: 'r1', name: 'Living Room' },
                    { id: 'r2', name: 'Kitchen' },
                    { id: 'r3', name: 'Master Bedroom' },
                    { id: 'r4', name: 'Bathroom' },
                    { id: 'r5', name: 'Garage' }
                ],
                members: [{ id: 'm1', name: 'Alex Johnson', role: 'owner' }],
                devices: [
                    { id: 'd1', name: 'Main Lights', type: 'light', room: 'r1', status: '80', mode: 'Warm', isOnline: true },
                    { id: 'd2', name: 'TV Hub', type: 'media', room: 'r1', status: 'Off', isOnline: false },
                    { id: 'd3', name: 'Thermostat', type: 'climate', room: 'r1', status: '24', mode: 'Auto', isOnline: true },
                    { id: 'd4', name: 'Kitchen Light', type: 'light', room: 'r2', status: 'Off', mode: 'Cool', isOnline: true },
                    { id: 'd5', name: 'Smart Oven', type: 'media', room: 'r2', status: 'Off', isOnline: true },
                    { id: 'd6', name: 'Bedroom AC', type: 'climate', room: 'r3', status: '22', mode: 'Eco', isOnline: true },
                    { id: 'd7', name: 'Night Lamp', type: 'light', room: 'r3', status: '30', mode: 'Soft', isOnline: true },
                    { id: 'd8', name: 'Geyser', type: 'light', room: 'r4', status: 'Off', isOnline: true },
                    { id: 'd9', name: 'Garage Door', type: 'media', room: 'r5', status: 'Closed', isOnline: true }
                ]
            }
        ];

        const loadActorMap = () => {
            try {
                const raw = localStorage.getItem(ACTOR_KEY);
                if (!raw) return {};
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_) {
                return {};
            }
        };

        const saveActorMap = (map) => {
            try {
                localStorage.setItem(ACTOR_KEY, JSON.stringify(map || {}));
            } catch (_) { }
        };

        const loadHomes = () => {
            try {
                const raw = localStorage.getItem(HOMES_KEY);
                if (!raw) return defaultHomes;
                return JSON.parse(raw);
            } catch (_) {
                return defaultHomes;
            }
        };

        const saveHomes = (homes) => {
            try {
                localStorage.setItem(HOMES_KEY, JSON.stringify(homes));
                window.dispatchEvent(new CustomEvent('thynco_homes_updated', { detail: { homes } }));
            } catch (_) { }
        };

        const notify = (homeId, event, data) => {
            const key = `${homeId}:${event}`;
            if (eventListeners.has(key)) {
                eventListeners.get(key).forEach(cb => cb(data));
            }
            // Also notify global event
            window.dispatchEvent(new CustomEvent(`thynco_home_${event}`, { detail: { homeId, ...data } }));
        };

        const getActorMemberId = (homeId) => {
            const map = loadActorMap();
            const id = map?.[homeId];
            if (typeof id === 'string' && id) return id;
            const me = UserManager.get();
            if (me?.id) return me.id;
            return null;
        };

        const setActorMemberId = (homeId, memberId) => {
            const map = loadActorMap();
            map[homeId] = memberId;
            saveActorMap(map);
            window.dispatchEvent(new CustomEvent('thynco_actor_changed', { detail: { homeId, memberId } }));
        };

        const findMember = (home, memberId) => (home?.members || []).find(m => m.id === memberId) || null;

        const getActorMember = (homeId) => {
            const home = loadHomes().find(h => h.id === homeId);
            if (!home) return null;
            const actorId = getActorMemberId(homeId);
            const member = findMember(home, actorId);
            if (member) return member;
            const fallback = home.members?.[0] || null;
            if (fallback?.id) setActorMemberId(homeId, fallback.id);
            return fallback;
        };

        const can = (homeId, action, memberId) => {
            const home = loadHomes().find(h => h.id === homeId);
            if (!home) return false;
            const id = memberId || getActorMemberId(homeId);
            const member = findMember(home, id);
            const role = member?.role || 'guest';
            return Permissions.can(role, action);
        };

        const guard = (homeId, action, opts) => {
            if (can(homeId, action, opts?.memberId)) return true;
            if (!opts?.silent) {
                const home = loadHomes().find(h => h.id === homeId);
                const actor = home ? getActorMember(homeId) : null;
                const role = actor?.role || 'guest';
                const label = Permissions.labelForRole(role);
                alert(`Permission denied (${label}): ${action}`);
            }
            return false;
        };

        const ensureDefaultMember = (home) => {
            if (!home) return home;
            if (!Array.isArray(home.members)) home.members = [];
            if (home.members.length === 0) {
                const me = UserManager.get();
                const owner = { id: me.id || uid(), name: me.name || 'You', role: 'owner' };
                home.members = [owner];
            }
            const hasOwner = home.members.some(m => Permissions.normalizeRole(m.role) === 'owner');
            if (!hasOwner) {
                home.members[0].role = 'owner';
            }
            return home;
        };

        return {
            getHomes: () => loadHomes(),
            getHome: (id) => loadHomes().find(h => h.id === id),
            getActiveId: () => localStorage.getItem(ACTIVE_HOME_KEY) || loadHomes()[0]?.id,
            setActiveId: (id) => {
                localStorage.setItem(ACTIVE_HOME_KEY, id);
                window.dispatchEvent(new CustomEvent('thynco_home_changed', { detail: { id } }));
            },
            getActorMemberId: (homeId) => getActorMemberId(homeId),
            setActorMemberId: (homeId, memberId) => setActorMemberId(homeId, memberId),
            getActorMember: (homeId) => getActorMember(homeId),
            can: (homeId, action, memberId) => can(homeId, action, memberId),
            upsertHome: (home) => {
                const homes = loadHomes();
                const idx = homes.findIndex(h => h.id === home.id);
                if (idx >= 0) {
                    if (!guard(home.id, 'home:edit')) return false;
                    homes[idx] = ensureDefaultMember({ ...homes[idx], ...home });
                }
                else {
                    const next = ensureDefaultMember({ rooms: [], members: [], devices: [], ...home });
                    homes.push(next);
                    const actorId = getActorMemberId(next.id);
                    const member = findMember(next, actorId);
                    if (!member && next.members?.[0]?.id) setActorMemberId(next.id, next.members[0].id);
                }
                saveHomes(homes);
                notify(home.id, 'modified', home);
                return true;
            },
            removeHome: (id) => {
                if (!guard(id, 'home:delete')) return false;
                const homes = loadHomes().filter(h => h.id !== id);
                saveHomes(homes);
                return true;
            },
            // Room Management
            addRoom: (homeId, room) => {
                if (!guard(homeId, 'room:manage')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return;
                home.rooms.push({ id: `r_${Date.now()}`, ...room });
                saveHomes(homes);
                notify(homeId, 'room_added', room);
                return true;
            },
            removeRoom: (homeId, roomId) => {
                if (!guard(homeId, 'room:manage')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return false;
                const before = home.rooms || [];
                home.rooms = before.filter(r => r.id !== roomId);
                const fallbackRoom = home.rooms?.[0]?.id || null;
                if (fallbackRoom) {
                    (home.devices || []).forEach(d => {
                        if (d.room === roomId) d.room = fallbackRoom;
                    });
                }
                saveHomes(homes);
                notify(homeId, 'room_removed', { id: roomId });
                return true;
            },
            // Device Management
            addDevice: (homeId, device) => {
                if (!guard(homeId, 'device:add')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return;
                const newDevice = { id: `d_${Date.now()}`, status: 'Off', isOnline: true, ...device };
                home.devices.push(newDevice);
                saveHomes(homes);
                notify(homeId, 'device_added', newDevice);
                return true;
            },
            updateDevice: (homeId, deviceId, updates) => {
                if (!guard(homeId, 'device:update', { silent: true })) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return;
                const device = home.devices.find(d => d.id === deviceId);
                if (!device) return;
                Object.assign(device, updates);
                saveHomes(homes);
                notify(homeId, 'device_updated', device);
                if (updates.status !== undefined) notify(homeId, 'device_status_changed', device);
                return true;
            },
            removeDevice: (homeId, deviceId) => {
                if (!guard(homeId, 'device:remove')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return;
                home.devices = home.devices.filter(d => d.id !== deviceId);
                saveHomes(homes);
                notify(homeId, 'device_removed', { id: deviceId });
                return true;
            },
            addMember: (homeId, member) => {
                if (!guard(homeId, 'member:invite')) return null;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return null;
                ensureDefaultMember(home);
                const role = Permissions.normalizeRole(member?.role || 'guest');
                const next = { id: member?.id || uid(), name: (member?.name || '').toString().trim() || 'New Member', role };
                if (home.members.some(m => m.id === next.id)) return null;
                home.members.push(next);
                saveHomes(homes);
                notify(homeId, 'member_added', next);
                return next;
            },
            removeMember: (homeId, memberId) => {
                if (!guard(homeId, 'member:remove')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return false;
                ensureDefaultMember(home);
                const target = findMember(home, memberId);
                if (!target) return false;
                if (Permissions.normalizeRole(target.role) === 'owner') {
                    alert('You cannot remove the owner. Transfer ownership first.');
                    return false;
                }
                home.members = home.members.filter(m => m.id !== memberId);
                const actorId = getActorMemberId(homeId);
                if (actorId === memberId) {
                    const fallback = home.members?.[0]?.id;
                    if (fallback) setActorMemberId(homeId, fallback);
                }
                saveHomes(homes);
                notify(homeId, 'member_removed', { id: memberId });
                return true;
            },
            leaveHome: (homeId) => {
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return false;
                ensureDefaultMember(home);
                const actorId = getActorMemberId(homeId);
                const actor = findMember(home, actorId);
                if (!actor) return false;
                if (Permissions.normalizeRole(actor.role) === 'owner') {
                    alert('Owner cannot leave the home. Transfer ownership first.');
                    return false;
                }
                home.members = home.members.filter(m => m.id !== actorId);
                const fallback = home.members?.[0]?.id;
                if (fallback) setActorMemberId(homeId, fallback);
                saveHomes(homes);
                notify(homeId, 'member_left', { id: actorId });
                return true;
            },
            updateMemberRole: (homeId, memberId, role) => {
                if (!guard(homeId, 'member:role')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return false;
                ensureDefaultMember(home);
                const target = findMember(home, memberId);
                if (!target) return false;
                const nextRole = Permissions.normalizeRole(role);
                if (Permissions.normalizeRole(target.role) === 'owner') {
                    alert('You cannot change the owner role. Transfer ownership instead.');
                    return false;
                }
                if (nextRole === 'owner') {
                    alert('Use Transfer Ownership to assign an owner.');
                    return false;
                }
                target.role = nextRole;
                saveHomes(homes);
                notify(homeId, 'member_role_updated', { id: memberId, role: nextRole });
                return true;
            },
            transferOwnership: (homeId, newOwnerId) => {
                if (!guard(homeId, 'member:transfer')) return false;
                const homes = loadHomes();
                const home = homes.find(h => h.id === homeId);
                if (!home) return false;
                ensureDefaultMember(home);
                const newOwner = findMember(home, newOwnerId);
                if (!newOwner) return false;
                const currentOwner = home.members.find(m => Permissions.normalizeRole(m.role) === 'owner') || null;
                if (currentOwner && currentOwner.id === newOwnerId) return true;
                if (currentOwner) currentOwner.role = 'admin';
                newOwner.role = 'owner';
                saveHomes(homes);
                notify(homeId, 'ownership_transferred', { from: currentOwner?.id, to: newOwnerId });
                return true;
            },
            // Event Listener
            on: (homeId, event, callback) => {
                const key = `${homeId}:${event}`;
                if (!eventListeners.has(key)) eventListeners.set(key, []);
                eventListeners.get(key).push(callback);
            },
            off: (homeId, event, callback) => {
                const key = `${homeId}:${event}`;
                if (!eventListeners.has(key)) return;
                eventListeners.set(key, eventListeners.get(key).filter(cb => cb !== callback));
            }
        };
    })();

    window.HomeManager = HomeManager;

    const initStatusBar = () => {
        const viewport = document.querySelector('#canvas-viewport');
        if (!viewport) return;

        const statusBar = document.createElement('div');
        statusBar.className = 'ios-status-bar';
        statusBar.innerHTML = `
            <div class="ios-status-left">
                <span data-status-time>9:41</span>
            </div>
            <div class="ios-notch"></div>
            <div class="ios-status-right">
                <div class="ios-signal">
                    <div class="bar bar-1"></div>
                    <div class="bar bar-2"></div>
                    <div class="bar bar-3"></div>
                    <div class="bar bar-4"></div>
                </div>
                <div class="ios-wifi">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.0002 19.1071L12.0002 19.1071C11.6669 19.1071 11.3335 18.9804 11.0802 18.7271L2.37354 10.0204C1.86687 9.51375 1.86687 8.68708 2.37354 8.18041C7.68021 2.87375 16.3202 2.87375 21.6269 8.18041C22.1335 8.68708 22.1335 9.51375 21.6269 10.0204L12.9202 18.7271C12.6669 18.9804 12.3335 19.1071 12.0002 19.1071Z"></path>
                    </svg>
                </div>
                <div class="ios-battery">
                    <div class="battery-body">
                        <div class="battery-level"></div>
                    </div>
                    <div class="battery-tip"></div>
                </div>
            </div>
        `;
        viewport.appendChild(statusBar);

        const timeEl = statusBar.querySelector('[data-status-time]');
        let intervalId = null;
        let lockedToSlider = false;
        const updateTime = () => {
            if (lockedToSlider) return;
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            if (timeEl) timeEl.textContent = `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
        };

        updateTime();
        intervalId = setInterval(updateTime, 1000 * 30);

        window.addEventListener('thynco_time_slider_changed', (e) => {
            const minutes = e?.detail?.minutes;
            if (!Number.isFinite(minutes)) return;
            const h = Math.floor(minutes / 60) % 24;
            const m = Math.floor(minutes % 60);
            if (timeEl) timeEl.textContent = `${h}:${m < 10 ? '0' : ''}${m}`;
            lockedToSlider = true;
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
        });
    };

    const initTimeSlider = () => {
        const viewport = document.querySelector('#canvas-viewport');
        if (!viewport) return null;
        if (document.querySelector('[data-time-slider-panel]')) return null;

        const key = 'thynco_time_slider_v1';

        const clamp01 = (t) => Math.max(0, Math.min(1, t));
        const hexToRgb = (hex) => {
            const raw = (hex || '').toString().replace('#', '').trim();
            const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
            if (full.length !== 6) return null;
            const n = parseInt(full, 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        };
        const rgbToHex = (r, g, b) => {
            const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
            return `#${to(r)}${to(g)}${to(b)}`;
        };
        const rgbToHsl = ({ r, g, b }) => {
            const rr = r / 255;
            const gg = g / 255;
            const bb = b / 255;
            const max = Math.max(rr, gg, bb);
            const min = Math.min(rr, gg, bb);
            const d = max - min;
            let h = 0;
            let s = 0;
            const l = (max + min) / 2;
            if (d !== 0) {
                s = d / (1 - Math.abs(2 * l - 1));
                switch (max) {
                    case rr:
                        h = ((gg - bb) / d) % 6;
                        break;
                    case gg:
                        h = (bb - rr) / d + 2;
                        break;
                    default:
                        h = (rr - gg) / d + 4;
                        break;
                }
                h *= 60;
                if (h < 0) h += 360;
            }
            return { h, s, l };
        };
        const hslToRgb = ({ h, s, l }) => {
            const hh = ((h % 360) + 360) % 360;
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
            const m = l - c / 2;
            let rr = 0, gg = 0, bb = 0;
            if (hh < 60) { rr = c; gg = x; bb = 0; }
            else if (hh < 120) { rr = x; gg = c; bb = 0; }
            else if (hh < 180) { rr = 0; gg = c; bb = x; }
            else if (hh < 240) { rr = 0; gg = x; bb = c; }
            else if (hh < 300) { rr = x; gg = 0; bb = c; }
            else { rr = c; gg = 0; bb = x; }
            return {
                r: (rr + m) * 255,
                g: (gg + m) * 255,
                b: (bb + m) * 255
            };
        };
        const mixHsl = (a, b, t) => {
            const ar = hexToRgb(a);
            const br = hexToRgb(b);
            if (!ar || !br) return a;
            const mt = clamp01(t);
            const ah = rgbToHsl(ar);
            const bh = rgbToHsl(br);
            const dh = ((((bh.h - ah.h) % 360) + 540) % 360) - 180;
            const h = ah.h + dh * mt;
            const s = ah.s + (bh.s - ah.s) * mt;
            const l = ah.l + (bh.l - ah.l) * mt;
            const rgb = hslToRgb({ h, s, l });
            return rgbToHex(rgb.r, rgb.g, rgb.b);
        };
        const rgbVar = (hex) => {
            const r = hexToRgb(hex);
            if (!r) return '';
            return `${r.r} ${r.g} ${r.b}`;
        };

        const palettes = {
            night: {
                primary: '#1A237E', // 深靛蓝
                accent: '#283593', 
                extra: '#3F51B5',
                bg1: '#0D1117',
                bg2: '#161B22',
                bg3: '#010409'
            },
            dawn: {
                primary: '#4A90E2', // 天空蓝
                accent: '#FF8A65', // 晨曦橘
                extra: '#7E57C2', // 晨雾紫
                bg1: '#F5F7FA',
                bg2: '#FFF5F0',
                bg3: '#ffffff'
            },
            noon: {
                primary: '#007AFF', // 经典蓝
                accent: '#4FC3F7', 
                extra: '#2196F3',
                bg1: '#F0F7FF',
                bg2: '#F5FAFF',
                bg3: '#ffffff'
            },
            dusk: {
                primary: '#5C6BC0', // 暮色蓝
                accent: '#FF7043', // 晚霞橘
                extra: '#AB47BC', // 晚霞紫
                bg1: '#FFF3E0',
                bg2: '#F3E5F5',
                bg3: '#ffffff'
            }
        };

        const getMinutesNow = () => {
            const d = new Date();
            return d.getHours() * 60 + d.getMinutes();
        };

        const formatTime = (minutes) => {
            const h = Math.floor(minutes / 60) % 24;
            const m = Math.floor(minutes % 60);
            return `${h}:${m < 10 ? '0' : ''}${m}`;
        };

        const applyTheme = (t01) => {
            const smooth = (x) => {
                const t = clamp01(x);
                return t * t * (3 - 2 * t);
            };
            const tt = smooth(t01);

            const minutes = Math.round(clamp01(t01) * 1439);
            const seg = (from, to, t) => ({
                primary: mixHsl(from.primary, to.primary, t),
                accent: mixHsl(from.accent, to.accent, t),
                extra: mixHsl(from.extra, to.extra, t),
                bg1: mixHsl(from.bg1, to.bg1, t),
                bg2: mixHsl(from.bg2, to.bg2, t),
                bg3: mixHsl(from.bg3, to.bg3, t)
            });

            const dawnAt = 390;
            const noonAt = 750;
            const duskAt = 1110;

            let base;
            if (minutes < dawnAt) {
                base = seg(palettes.night, palettes.dawn, smooth(minutes / dawnAt));
            } else if (minutes < noonAt) {
                base = seg(palettes.dawn, palettes.noon, smooth((minutes - dawnAt) / (noonAt - dawnAt)));
            } else if (minutes < duskAt) {
                base = seg(palettes.noon, palettes.dusk, smooth((minutes - noonAt) / (duskAt - noonAt)));
            } else {
                base = seg(palettes.dusk, palettes.night, smooth((minutes - duskAt) / (1440 - duskAt)));
            }

            const tune = (hex, sMul, lMul, lAdd) => {
                const rgb = hexToRgb(hex);
                if (!rgb) return hex;
                const hsl = rgbToHsl(rgb);
                const s = clamp01(hsl.s * sMul);
                const l = clamp01(hsl.l * lMul + lAdd);
                const out = hslToRgb({ h: hsl.h, s, l });
                return rgbToHex(out.r, out.g, out.b);
            };

            const primary = tune(base.primary, 0.75, 1.0, 0.0);
            const accent = tune(base.accent, 0.7, 1.0, 0.01);
            const extra = tune(base.extra, 0.65, 1.0, 0.01);
            const bg1 = tune(base.bg1, 0.2, 1.05, 0.1);
            const bg2 = tune(base.bg2, 0.18, 1.05, 0.12);
            const bg3 = tune(base.bg3, 0.0, 1.0, 0.0);
            const sunset = base.sunset || base.accent;

            const primaryContainer = mixHsl(primary, '#ffffff', 0.93);

            const root = document.documentElement.style;
            root.setProperty('--primary', primary);
            root.setProperty('--primary-rgb', rgbVar(primary));
            root.setProperty('--primary-container', primaryContainer);
            root.setProperty('--accent', accent);
            root.setProperty('--accent-rgb', rgbVar(accent));
            root.setProperty('--extra', extra);
            root.setProperty('--extra-rgb', rgbVar(extra));
            root.setProperty('--sunset', sunset);
            root.setProperty('--sunset-rgb', rgbVar(sunset));
            root.setProperty('--bg-mesh-1', bg1);
            root.setProperty('--bg-mesh-2', bg2);
            root.setProperty('--bg-mesh-3', bg3);
        };

        const panel = document.createElement('div');
        panel.className = 'time-slider-panel';
        panel.setAttribute('data-time-slider-panel', '');
        panel.innerHTML = `
            <div class="time-slider-head">
                <div class="time-slider-title">时间</div>
                <div class="time-slider-value" data-time-slider-value>--:--</div>
            </div>
            <input class="time-slider-range" type="range" min="0" max="1439" step="5" data-time-slider-range aria-label="Time slider" />
            <div class="time-slider-hint">拖动模拟从清晨到日落的天空色。</div>
        `;
        document.body.appendChild(panel);

        const range = panel.querySelector('[data-time-slider-range]');
        const valueEl = panel.querySelector('[data-time-slider-value]');
        if (!(range instanceof HTMLInputElement) || !(valueEl instanceof HTMLElement)) return null;

        const load = () => {
            try {
                const raw = localStorage.getItem(key);
                const n = Number(raw);
                if (Number.isFinite(n)) return Math.max(0, Math.min(1439, Math.round(n)));
            } catch (_) { }
            return getMinutesNow();
        };

        const persist = (minutes) => {
            try { localStorage.setItem(key, String(minutes)); } catch (_) { }
        };

        const setMinutes = (minutes, shouldPersist) => {
            const m = Math.max(0, Math.min(1439, Math.round(minutes)));
            range.value = String(m);
            valueEl.textContent = formatTime(m);
            const t01 = m / 1439;
            applyTheme(t01);
            window.dispatchEvent(new CustomEvent('thynco_time_slider_changed', { detail: { minutes: m } }));
            if (shouldPersist) persist(m);
        };

        setMinutes(load(), false);

        range.addEventListener('input', () => {
            setMinutes(Number(range.value), true);
        });

        return { setMinutes };
    };

    const initMeshBackground = () => {
        const viewport = document.querySelector('#canvas-viewport');
        if (!viewport) return null;
        const mesh = viewport.querySelector('.mesh-bg');
        if (!(mesh instanceof HTMLElement)) return null;

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const pct = (v) => `${clamp(v, 4, 96).toFixed(2)}%`;

        const seedKey = 'thynco_mesh_seed_v2';
        const loadSeed = () => {
            try {
                const raw = sessionStorage.getItem(seedKey);
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 1 && n <= 0x7fffffff) return Math.floor(n);
            } catch (_) { }
            const gen = Math.floor(1 + Math.random() * 0x7ffffffe);
            try { sessionStorage.setItem(seedKey, String(gen)); } catch (_) { }
            return gen;
        };

        const mulberry32 = (a) => {
            let t = a >>> 0;
            return () => {
                t += 0x6D2B79F5;
                let x = t;
                x = Math.imul(x ^ (x >>> 15), x | 1);
                x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
                return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
            };
        };

        const seed = loadSeed();
        const rand = mulberry32(seed);
        const sunDir = rand() < 0.5 ? 1 : -1;

        const phase = {
            a: rand() * Math.PI * 2,
            b: rand() * Math.PI * 2,
            c: rand() * Math.PI * 2,
            d: rand() * Math.PI * 2,
            e: rand() * Math.PI * 2,
            f: rand() * Math.PI * 2,
            g: rand() * Math.PI * 2,
            h: rand() * Math.PI * 2
        };

        const bias = {
            x1: (rand() - 0.5) * 12,
            y1: (rand() - 0.5) * 10,
            x2: (rand() - 0.5) * 11,
            y2: (rand() - 0.5) * 9,
            x3: (rand() - 0.5) * 14,
            y3: (rand() - 0.5) * 14,
            x4: (rand() - 0.5) * 18,
            y4: (rand() - 0.5) * 16
        };

        const drift = {
            startTs: Date.now(),
            durationMs: 14000 + Math.floor(rand() * 6000),
            from: { ...bias },
            to: { ...bias }
        };

        const retarget = () => {
            drift.startTs = Date.now();
            drift.durationMs = 14000 + Math.floor(rand() * 6000);
            drift.from = { ...drift.to };
            drift.to = {
                x1: (rand() - 0.5) * 12,
                y1: (rand() - 0.5) * 10,
                x2: (rand() - 0.5) * 11,
                y2: (rand() - 0.5) * 9,
                x3: (rand() - 0.5) * 14,
                y3: (rand() - 0.5) * 14,
                x4: (rand() - 0.5) * 18,
                y4: (rand() - 0.5) * 16
            };
        };

        retarget();

        const getMinutes = () => {
            try {
                const raw = localStorage.getItem('thynco_time_slider_v1');
                const n = Number(raw);
                if (Number.isFinite(n)) return clamp(Math.round(n), 0, 1439);
            } catch (_) { }
            const d = new Date();
            return d.getHours() * 60 + d.getMinutes();
        };

        let minutes = getMinutes();

        const apply = () => {
            const now = Date.now() / 1000;
            const dawnAt = 390;
            const noonAt = 750;
            const duskAt = 1110;
            const dayT = (minutes - dawnAt) / (duskAt - dawnAt);
            const dayClamped = clamp(dayT, 0, 1);
            const sunHeight = Math.sin(Math.PI * dayClamped);

            const wobble = (amp, speed, p) => amp * Math.sin(now * speed + p);

            const sunTravel = dayClamped;
            const sunXStart = sunDir === 1 ? 22 : 78;
            const sunXEnd = sunDir === 1 ? 78 : 22;
            const sunXBase = sunXStart + (sunXEnd - sunXStart) * sunTravel;
            const sunYBase = 82 - 54 * sunHeight;

            const dt = Date.now() - drift.startTs;
            const u = clamp(dt / drift.durationMs, 0, 1);
            const eased = u * u * (3 - 2 * u);
            const lerp = (a, b) => a + (b - a) * eased;

            const d = {
                x1: lerp(drift.from.x1, drift.to.x1),
                y1: lerp(drift.from.y1, drift.to.y1),
                x2: lerp(drift.from.x2, drift.to.x2),
                y2: lerp(drift.from.y2, drift.to.y2),
                x3: lerp(drift.from.x3, drift.to.x3),
                y3: lerp(drift.from.y3, drift.to.y3),
                x4: lerp(drift.from.x4, drift.to.x4),
                y4: lerp(drift.from.y4, drift.to.y4)
            };

            if (u >= 1) retarget();

            const sunX = sunXBase + d.x1 + wobble(4.2, 0.06, phase.a) + wobble(2.4, 0.11, phase.b);
            const sunY = sunYBase + d.y1 + wobble(3.6, 0.055, phase.c) + wobble(2.0, 0.12, phase.d);

            const coolX = (100 - sunXBase) + d.x2 + wobble(3.2, 0.05, phase.e);
            const coolY = (18 + 26 * (1 - sunHeight)) + d.y2 + wobble(2.8, 0.052, phase.f);

            const horizon = 60 + 22 * (1 - sunHeight);
            const accentX = (50 + (sunXBase - 50) * 0.32) + d.x3 + wobble(4.2, 0.04, phase.g);
            const accentY = horizon + d.y3 + wobble(3.6, 0.043, phase.h);

            const fillX = 50 + d.x4 + wobble(5.2, 0.028, phase.b) + wobble(3.1, 0.04, phase.c);
            const fillY = 46 + d.y4 + wobble(4.4, 0.03, phase.d) + wobble(2.6, 0.041, phase.e);

            mesh.style.setProperty('--mesh-1-x', pct(sunX));
            mesh.style.setProperty('--mesh-1-y', pct(sunY));
            mesh.style.setProperty('--mesh-2-x', pct(coolX));
            mesh.style.setProperty('--mesh-2-y', pct(coolY));
            mesh.style.setProperty('--mesh-3-x', pct(accentX));
            mesh.style.setProperty('--mesh-3-y', pct(accentY));
            mesh.style.setProperty('--mesh-4-x', pct(fillX));
            mesh.style.setProperty('--mesh-4-y', pct(fillY));

            const dayFactor = sunHeight;
            const pulse = 0.012 * Math.sin(now * 0.13 + phase.f);
            const intensity = 0.9 - 0.11 * dayFactor + 0.06 * (1 - dayFactor) + pulse;
            mesh.style.setProperty('--mesh-opacity', String(clamp(intensity, 0.76, 0.96)));
        };

        apply();
        const tickId = setInterval(apply, 220);

        window.addEventListener('thynco_time_slider_changed', (e) => {
            const m = e?.detail?.minutes;
            if (!Number.isFinite(m)) return;
            minutes = clamp(Math.round(m), 0, 1439);
            apply();
        });

        window.addEventListener('pagehide', () => clearInterval(tickId), { once: true });
        return { apply };
    };

    const initHomeIndicator = () => {
        const viewport = document.querySelector('#canvas-viewport');
        if (!viewport) return;

        const indicator = document.createElement('div');
        indicator.className = 'ios-home-indicator';
        viewport.appendChild(indicator);
    };

    const initNavTransitions = () => {
        const viewport = document.querySelector('#canvas-viewport');
        const appContent = document.querySelector('#app-content');
        if (!viewport || !appContent) return null;

        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const overlayKey = 'thynco_nav_transition_v1';

        let overlay = viewport.querySelector('[data-nav-overlay]');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            overlay.setAttribute('data-nav-overlay', '');
            viewport.appendChild(overlay);
        }

        const playEnter = () => {
            const was = sessionStorage.getItem(overlayKey) === '1';
            if (!was) return;
            sessionStorage.removeItem(overlayKey);
            overlay.classList.add('active');
            requestAnimationFrame(() => {
                overlay.classList.remove('active');
            });
        };

        const navigate = (href) => {
            if (!href) return;
            if (prefersReducedMotion) {
                location.href = href;
                return;
            }
            try { sessionStorage.setItem(overlayKey, '1'); } catch (_) { }
            overlay.classList.add('active');
            appContent.classList.add('nav-exit');
            setTimeout(() => {
                location.href = href;
            }, 180);
        };

        document.addEventListener('click', (e) => {
            const el = e.target.closest?.('[data-nav-to]');
            if (!el) return;
            const href = el.getAttribute('data-nav-to');
            if (!href) return;
            e.preventDefault();
            e.stopPropagation();
            navigate(href);
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const el = e.target.closest?.('[data-nav-to]');
            if (!el) return;
            const href = el.getAttribute('data-nav-to');
            if (!href) return;
            e.preventDefault();
            e.stopPropagation();
            navigate(href);
        }, true);

        window.addEventListener('pageshow', playEnter);
        playEnter();
        return { navigate };
    };

    const initHomePicker = () => {
        const nameTargets = Array.from(document.querySelectorAll('[data-home-name]'));
        const openers = Array.from(document.querySelectorAll('[data-home-picker-open]'));
        if (nameTargets.length === 0 && openers.length === 0) return null;

        const nearestKey = 'thynco_nearest_home_v1';
        const nearestTtlMs = 5 * 60 * 1000;

        const getHomes = () => HomeManager.getHomes();
        const getActiveId = () => HomeManager.getActiveId();
        const setActiveId = (id) => HomeManager.setActiveId(id);
        const getHome = (id) => HomeManager.getHome(id);

        const getNearestCached = () => {
            try {
                const raw = sessionStorage.getItem(nearestKey);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed?.id || typeof parsed?.ts !== 'number') return null;
                if (Date.now() - parsed.ts > nearestTtlMs) return null;
                return getHomes().some(h => h.id === parsed.id) ? parsed.id : null;
            } catch (_) {
                return null;
            }
        };

        const setNearestCached = (id) => {
            if (!getHomes().some(h => h.id === id)) return;
            try {
                sessionStorage.setItem(nearestKey, JSON.stringify({ id, ts: Date.now() }));
            } catch (_) { }
        };

        const haversineKm = (a, b) => {
            const toRad = (d) => (d * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(b.lat - a.lat);
            const dLng = toRad(b.lng - a.lng);
            const s1 = Math.sin(dLat / 2);
            const s2 = Math.sin(dLng / 2);
            const x = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
            return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
        };

        const pickNearestHomeId = (pos) => {
            const origin = { lat: pos.latitude, lng: pos.longitude };
            const homes = getHomes();
            let best = homes[0];
            let bestD = Number.POSITIVE_INFINITY;
            homes.forEach(h => {
                if (typeof h.lat !== 'number' || typeof h.lng !== 'number') return;
                const d = haversineKm(origin, { lat: h.lat, lng: h.lng });
                if (d < bestD) {
                    bestD = d;
                    best = h;
                }
            });
            return best?.id || homes[0].id;
        };

        const renderNames = () => {
            const active = getHome(getActiveId());
            if (!active) return;
            document.querySelectorAll('[data-home-name]').forEach(n => { n.textContent = active.name; });
            document.querySelectorAll('[data-home-id]').forEach(n => { n.textContent = active.id; });
        };

        if (!document.querySelector('[data-home-picker-overlay]')) {
            const host = document.querySelector('#canvas-viewport') || document.querySelector('#app-content') || document.body;
            const wrap = document.createElement('div');
            wrap.innerHTML = `
                <div class="home-picker-overlay" data-home-picker-overlay aria-hidden="true">
                    <div class="home-picker-backdrop" data-home-picker-backdrop></div>
                    <div class="home-picker-sheet" data-home-picker-sheet role="dialog" aria-modal="true" aria-label="Select home">
                        <div class="home-picker-handle"></div>
                        <div class="home-picker-head">
                            <div class="home-picker-head-left">
                                <div class="home-picker-title">Homes</div>
                                <div class="home-picker-subtitle" data-home-picker-nearest>Nearest: —</div>
                            </div>
                            <button type="button" class="circle-btn home-picker-add" aria-label="Add home" data-home-picker-add>
                                <span class="material-icons">add</span>
                            </button>
                        </div>
                        <div class="home-picker-list" data-home-picker-list></div>
                    </div>
                </div>
            `.trim();
            host.appendChild(wrap.firstChild);
        }

        const overlay = document.querySelector('[data-home-picker-overlay]');
        const backdrop = document.querySelector('[data-home-picker-backdrop]');
        const sheet = document.querySelector('[data-home-picker-sheet]');
        const list = document.querySelector('[data-home-picker-list]');
        const nearestText = document.querySelector('[data-home-picker-nearest]');
        const addBtn = document.querySelector('[data-home-picker-add]');
        if (!overlay || !backdrop || !sheet || !list) return null;

        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const isOpen = () => overlay.classList.contains('active');

        const close = () => {
            if (!isOpen()) return;
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        };

        const open = () => {
            if (isOpen()) return;
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
            const first = list.querySelector('button');
            if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
        };

        let nearestId = getNearestCached();

        const setNearestUi = (id) => {
            const homes = getHomes();
            nearestId = homes.some(h => h.id === id) ? id : null;
            if (nearestText) {
                const h = nearestId ? getHome(nearestId) : null;
                nearestText.textContent = h ? `Nearest: ${h.name}` : 'Nearest: unavailable';
            }
        };

        const updateNearest = () => {
            const cached = getNearestCached();
            if (cached) {
                setNearestUi(cached);
                return;
            }

            if (!navigator.geolocation) {
                setNearestUi(null);
                return;
            }

            try {
                navigator.geolocation.getCurrentPosition((p) => {
                    const id = pickNearestHomeId({ latitude: p.coords.latitude, longitude: p.coords.longitude });
                    setNearestCached(id);
                    setNearestUi(id);
                    buildList();
                }, () => {
                    setNearestUi(null);
                }, { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 });
            } catch (_) {
                setNearestUi(null);
            }
        };

        const buildList = () => {
            list.innerHTML = '';
            const activeId = getActiveId();
            getHomes().forEach(h => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `home-picker-item google-card ${h.id === activeId ? 'active' : ''} ${nearestId === h.id ? 'nearest' : ''}`;
                b.innerHTML = `
                    <div class="home-picker-item-icon" aria-hidden="true">
                        <span class="material-icons">home</span>
                    </div>
                    <div class="home-picker-item-left">
                        <div class="home-picker-item-name">${h.name}</div>
                        <div class="home-picker-item-sub">${h.id.toUpperCase()}</div>
                    </div>
                    ${nearestId === h.id ? `<span class="home-picker-item-badge" aria-hidden="true">Nearest</span>` : ''}
                    <span class="home-picker-item-edit" role="button" tabindex="0" aria-label="Edit home" data-home-picker-edit="${h.id}">
                        <span class="material-icons" aria-hidden="true">edit</span>
                    </span>
                    <span class="material-icons home-picker-item-check">${h.id === activeId ? 'check' : 'radio_button_unchecked'}</span>
                `.trim();
                b.addEventListener('click', () => {
                    setActiveId(h.id);
                    if (!prefersReducedMotion) {
                        b.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
                    }
                    close();
                });
                list.appendChild(b);
            });

            list.querySelectorAll('[data-home-picker-edit]').forEach(el => {
                if (!(el instanceof HTMLElement)) return;
                const id = el.getAttribute('data-home-picker-edit') || '';
                const go = () => {
                    if (!id) return;
                    close();
                    location.href = `home-management.html?homeId=${encodeURIComponent(id)}`;
                };
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    go();
                });
                el.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    e.stopPropagation();
                    go();
                });
            });
        };

        openers.forEach(o => {
            if (!(o instanceof HTMLElement)) return;
            o.addEventListener('click', () => {
                buildList();
                updateNearest();
                open();
            });
        });

        backdrop.addEventListener('click', close);
        addBtn?.addEventListener('click', () => { location.href = 'add-home.html'; });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        window.addEventListener('thynco_home_changed', () => { renderNames(); buildList(); });
        window.addEventListener('thynco_homes_updated', () => { buildList(); renderNames(); });

        renderNames();
        setNearestUi(nearestId);
        return { homes: getHomes(), getActiveId, setActiveId };
    };

    const initHomeOverview = () => {
        const online = document.querySelector('[data-home-overview-online]');
        const lights = document.querySelector('[data-home-overview-lights]');
        const security = document.querySelector('[data-home-overview-security]');

        if (!online || !lights || !security) return null;

        const key = 'thynco_device_overview_v1';
        const apply = (d) => {
            if (!d) return;
            if (typeof d.online === 'number') online.textContent = `${d.online}`;
            if (typeof d.lightsOn === 'number') lights.textContent = `${d.lightsOn}`;
            if (typeof d.security === 'string') security.textContent = d.security;
        };

        try {
            const raw = sessionStorage.getItem(key);
            if (raw) apply(JSON.parse(raw));
        } catch (_) { }

        return {};
    };

    const initHomeLayout = () => {
        const stage = document.querySelector('#home');
        if (!stage) return null;
        const blocks = Array.from(stage.querySelectorAll('[data-home-block]'));
        if (!blocks.length) return null;

        const header = stage.querySelector('.header');
        if (!header) return null;

        const key = 'thynco_home_layout_v1';
        const ids = blocks.map(b => b.getAttribute('data-home-block')).filter(Boolean);
        const map = new Map(blocks.map(b => [b.getAttribute('data-home-block'), b]));

        const load = () => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : null;
            } catch (_) {
                return null;
            }
        };

        const apply = (cfg) => {
            const order = Array.isArray(cfg?.order) ? cfg.order.filter(x => map.has(x)) : ids;
            const hidden = cfg?.hidden && typeof cfg.hidden === 'object' ? cfg.hidden : {};

            blocks.forEach(b => b.classList.remove('is-hidden'));
            blocks.forEach(b => {
                const id = b.getAttribute('data-home-block');
                if (id && hidden[id]) b.classList.add('is-hidden');
            });

            let anchor = header;
            order.forEach(id => {
                const el = map.get(id);
                if (!el) return;
                stage.insertBefore(el, anchor.nextSibling);
                anchor = el;
            });

            blocks.forEach(el => {
                if (!order.includes(el.getAttribute('data-home-block'))) {
                    stage.insertBefore(el, anchor.nextSibling);
                    anchor = el;
                }
            });
        };

        apply(load());
        window.addEventListener('pageshow', () => apply(load()));
        window.addEventListener('focus', () => apply(load()));
        return {};
    };

    const initHomeAutomations = () => {
        const stage = document.querySelector('#home');
        if (!stage) return null;
        const row = stage.querySelector('[data-home-routines]');
        if (!row) return null;

        const key = 'thynco_routines_v2';
        const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const normalize = (s) => (s || '').toString().trim();
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        const seed = () => ([
            {
                id: uid(),
                name: 'Good Morning',
                enabled: true,
                icon: 'wb_sunny',
                meta: '7:00 AM • Weekdays',
                conditions: [{ kind: 'trigger', title: 'Time of Day', subtitle: '7:00 AM, Weekdays', icon: 'schedule' }],
                tasks: [
                    { kind: 'action', title: 'Living Room Lights', subtitle: 'Turn On • 40% Warm', icon: 'lightbulb' },
                    { kind: 'action', title: 'Thermostat', subtitle: 'Set • 23°C', icon: 'thermostat' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 22
            },
            {
                id: uid(),
                name: 'Sleep Mode',
                enabled: false,
                icon: 'nightlight_round',
                meta: '11:00 PM • Daily',
                conditions: [{ kind: 'trigger', title: 'Time of Day', subtitle: '11:00 PM, Daily', icon: 'schedule' }],
                tasks: [
                    { kind: 'action', title: 'All lights', subtitle: 'Turn Off', icon: 'lightbulb' },
                    { kind: 'action', title: 'Front door', subtitle: 'Lock', icon: 'lock' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 23
            },
            {
                id: uid(),
                name: 'Movie Night',
                enabled: false,
                icon: 'movie',
                meta: '8:00 PM • Fri',
                conditions: [{ kind: 'trigger', title: 'Time of Day', subtitle: '8:00 PM, Fri', icon: 'schedule' }],
                tasks: [
                    { kind: 'action', title: 'Living Room Lights', subtitle: 'Turn On • 20% Dim', icon: 'lightbulb' },
                    { kind: 'action', title: 'TV Hub', subtitle: 'Turn On', icon: 'tv' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 24
            },
            {
                id: uid(),
                name: 'Arrive Home',
                enabled: true,
                icon: 'home',
                meta: 'When I arrive • Home',
                conditions: [{ kind: 'trigger', title: 'Location', subtitle: 'When I arrive home', icon: 'location_on' }],
                tasks: [
                    { kind: 'action', title: 'Entry Light', subtitle: 'Turn On', icon: 'lightbulb' },
                    { kind: 'action', title: 'AC', subtitle: 'Set • 24°C', icon: 'thermostat' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 8
            },
            {
                id: uid(),
                name: 'Leave Home',
                enabled: true,
                icon: 'logout',
                meta: 'When I leave • Home',
                conditions: [{ kind: 'trigger', title: 'Location', subtitle: 'When I leave home', icon: 'location_on' }],
                tasks: [
                    { kind: 'action', title: 'All lights', subtitle: 'Turn Off', icon: 'lightbulb' },
                    { kind: 'action', title: 'Front door', subtitle: 'Lock', icon: 'lock' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 9
            },
            {
                id: uid(),
                name: 'Party Mode',
                enabled: false,
                icon: 'celebration',
                meta: 'Manual trigger',
                conditions: [{ kind: 'trigger', title: 'Manual', subtitle: 'Tap to run', icon: 'play_arrow' }],
                tasks: [
                    { kind: 'action', title: 'Music', subtitle: 'Play • Party Mix', icon: 'speaker' },
                    { kind: 'action', title: 'Lights', subtitle: 'Color Loop', icon: 'palette' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 10
            },
            {
                id: uid(),
                name: 'Security Alert',
                enabled: true,
                icon: 'shield',
                meta: 'Any motion • 11PM-6AM',
                conditions: [{ kind: 'trigger', title: 'Motion Sensor', subtitle: 'Motion detected', icon: 'sensors' }],
                tasks: [
                    { kind: 'action', title: 'All lights', subtitle: 'Turn On • 100%', icon: 'lightbulb' },
                    { kind: 'action', title: 'Notification', subtitle: 'Motion detected!', icon: 'notifications' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 11
            },
            {
                id: uid(),
                name: 'Work Focus',
                enabled: false,
                icon: 'center_focus_strong',
                meta: '9:00 AM • Mon-Fri',
                conditions: [{ kind: 'trigger', title: 'Time of Day', subtitle: '9:00 AM, Mon-Fri', icon: 'schedule' }],
                tasks: [
                    { kind: 'action', title: 'Office Lights', subtitle: 'Turn On • 100% Cool White', icon: 'lightbulb' },
                    { kind: 'action', title: 'DND Mode', subtitle: 'Enable on Phone', icon: 'do_not_disturb_on' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 12
            },
            {
                id: uid(),
                name: 'Sunset Glow',
                enabled: true,
                icon: 'wb_twilight',
                meta: 'Sunset • Daily',
                conditions: [{ kind: 'trigger', title: 'Sunset', subtitle: 'When sun sets', icon: 'wb_sunny' }],
                tasks: [
                    { kind: 'action', title: 'Curtains', subtitle: 'Close', icon: 'curtains' },
                    { kind: 'action', title: 'Warm Lights', subtitle: 'Turn On • 30%', icon: 'lightbulb' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 13
            },
            {
                id: uid(),
                name: 'Eco Save',
                enabled: true,
                icon: 'eco',
                meta: 'Energy peak • Auto',
                conditions: [{ kind: 'trigger', title: 'Energy Price', subtitle: 'High price peak', icon: 'bolt' }],
                tasks: [
                    { kind: 'action', title: 'AC', subtitle: 'Eco Mode • 26°C', icon: 'thermostat' },
                    { kind: 'action', title: 'Pool Pump', subtitle: 'Pause', icon: 'pool' }
                ],
                createdAt: Date.now() - 1000 * 60 * 60 * 14
            }
        ]);

        const load = () => {
            try {
                const raw = sessionStorage.getItem(key);
                if (raw == null) {
                    const items = seed();
                    sessionStorage.setItem(key, JSON.stringify(items));
                    return items;
                }
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length < 10) {
                    const items = seed();
                    sessionStorage.setItem(key, JSON.stringify(items));
                    return items;
                }
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        };

        const save = (items) => {
            try {
                sessionStorage.setItem(key, JSON.stringify(items));
            } catch (_) { }
        };

        const buildMeta = (r) => {
            const raw = normalize(r?.meta);
            if (raw) return raw;
            const c0 = Array.isArray(r?.conditions) ? r.conditions[0] : null;
            const parts = [normalize(c0?.title), normalize(c0?.subtitle)].filter(Boolean);
            if (parts.length) return parts.join(' • ');
            const tCount = Array.isArray(r?.tasks) ? r.tasks.length : 0;
            if (tCount) return `${tCount} tasks`;
            return normalize(r?.trigger) || 'Ready';
        };

        const setEnabled = (id, enabled) => {
            const items = load();
            const idx = items.findIndex(x => x.id === id);
            if (idx < 0) return;
            items[idx] = { ...items[idx], enabled: !!enabled };
            save(items);
        };

        const render = () => {
            const items = load();
            row.innerHTML = '';

            const shown = items.slice(0, 10);
            if (!shown.length) {
                const empty = document.createElement('button');
                empty.type = 'button';
                empty.className = 'home-routine-tile google-card';
                empty.innerHTML = `
                    <div class="home-routine-left">
                        <div class="home-routine-icon"><span class="material-icons">auto_awesome</span></div>
                        <div>
                            <div class="home-routine-title">No automations</div>
                            <div class="home-routine-sub">Create your first routine</div>
                        </div>
                    </div>
                    <span class="material-icons" style="color:#c7c7cc;">chevron_right</span>
                `.trim();
                empty.addEventListener('click', () => {
                    location.href = 'scenes.html';
                });
                row.appendChild(empty);
                return;
            }

            shown.forEach(r => {
                const tile = document.createElement('div');
                tile.className = `home-routine-tile google-card`;
                tile.setAttribute('role', 'button');
                tile.setAttribute('tabindex', '0');
                tile.dataset.routineId = r.id || '';
                const icon = (r.icon || 'auto_awesome').toString();
                const title = (r.name || 'Routine').toString();
                const sub = buildMeta(r);
                tile.innerHTML = `
                    <div class="home-routine-left">
                        <div class="home-routine-icon"><span class="material-icons">${icon}</span></div>
                        <div style="min-width:0;">
                            <div class="home-routine-title">${title}</div>
                        </div>
                    </div>
                    <div class="action-spinner" hidden></div>
                `.trim();
                
                tile.addEventListener('click', (e) => {
                    const id = tile.dataset.routineId;
                    if (!id) return;
                    
                    // Show running feedback
                    const iconWrap = tile.querySelector('.home-routine-icon');
                    const spinner = tile.querySelector('.action-spinner');
                    if (iconWrap && spinner) {
                        const originalIcon = iconWrap.innerHTML;
                        iconWrap.innerHTML = '';
                        iconWrap.appendChild(spinner);
                        spinner.hidden = false;
                        tile.style.pointerEvents = 'none';
                        
                        setTimeout(() => {
                            iconWrap.innerHTML = originalIcon;
                            tile.style.pointerEvents = 'auto';
                            
                            if (!prefersReducedMotion) {
                                tile.animate([
                                    { transform: 'scale(1)' },
                                    { transform: 'scale(0.94)' },
                                    { transform: 'scale(1)' }
                                ], { duration: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
                            }
                        }, 800);
                    }
                });
                tile.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        tile.click();
                    }
                });
                row.appendChild(tile);
            });
        };

        render();
        window.addEventListener('pageshow', render);
        window.addEventListener('focus', render);
        window.addEventListener('thynco_routines_updated', render);
        return { render };
    };

    const initHomeOverflowMenu = () => {
        const stage = document.querySelector('#home');
        if (!stage) return null;
        const openBtn = stage.querySelector('[data-home-menu-open]');
        const pop = document.querySelector('[data-home-menu-popover]');
        const items = Array.from(document.querySelectorAll('[data-home-menu-item]'));
        if (!openBtn || !pop) return null;

        const viewport = document.querySelector('#canvas-viewport');
        const appContent = document.querySelector('#app-content');
        const overlay = viewport?.querySelector('[data-nav-overlay]');
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const overlayKey = 'thynco_nav_transition_v1';

        let closeTimer = null;
        const isOpen = () => pop.classList.contains('active') && !pop.classList.contains('is-hidden');

        const position = () => {
            if (!viewport) return;
            const v = viewport.getBoundingClientRect();
            const b = openBtn.getBoundingClientRect();
            const w = pop.offsetWidth || 200;
            const x = Math.max(12, Math.min(v.width - w - 12, (b.right - v.left) - w));
            const y = (b.top - v.top); // Grow from the button top
            pop.style.setProperty('--menu-x', `${x}px`);
            pop.style.setProperty('--menu-y', `${y}px`);
        };

        const close = () => {
            if (!isOpen()) return;
            pop.classList.remove('active');
            openBtn.classList.remove('active');
            const icon = openBtn.querySelector('.material-icons');
            if (icon) icon.textContent = 'more_horiz';
            
            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
                pop.classList.add('is-hidden');
            }, 400); // Wait for transition
        };

        const open = () => {
            if (closeTimer) clearTimeout(closeTimer);
            pop.classList.remove('is-hidden');
            openBtn.classList.add('active');
            const icon = openBtn.querySelector('.material-icons');
            if (icon) icon.textContent = 'close';
            
            requestAnimationFrame(() => {
                position();
                pop.classList.add('active');
            });
        };

        const navigate = (href) => {
            if (!href) return;
            if (prefersReducedMotion || !overlay || !appContent) {
                location.href = href;
                return;
            }
            try { sessionStorage.setItem(overlayKey, '1'); } catch (_) { }
            overlay.classList.add('active');
            appContent.classList.add('nav-exit');
            setTimeout(() => {
                location.href = href;
            }, 180);
        };

        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen()) close();
            else open();
        });

        document.addEventListener('click', (e) => {
            const t = e.target;
            if (!(t instanceof Node)) return;
            if (t === openBtn || openBtn.contains(t)) return;
            if (pop.contains(t)) return;
            close();
        }, true);

        window.addEventListener('resize', () => {
            if (isOpen()) position();
        });

        stage.addEventListener('scroll', close, { passive: true });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        items.forEach(b => {
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const href = b.getAttribute('data-home-menu-href') || '';
                close();
                setTimeout(() => navigate(href), prefersReducedMotion ? 0 : 80);
            });
        });

        return { open, close };
    };

    const initDevicesOverview = () => {
        const meta = document.querySelector('[data-devices-meta]');
        const overviewRow = document.querySelector('[data-devices-overview]');
        if (!meta && !overviewRow) return null;

        const overviewKey = 'thynco_device_overview_v1';
        const normalize = (s) => (s || '').toString().trim().toLowerCase();
        const getActiveHome = () => HomeManager.getHome(HomeManager.getActiveId());

        const render = () => {
            const home = getActiveHome();
            if (!home) return;
            const online = home.devices.length;
            const running = home.devices.filter(d => normalize(d.status) !== 'off' && d.status !== '0').length;
            const lightsOn = home.devices.filter(d => d.type === 'light' && normalize(d.status) !== 'off' && d.status !== '0').length;

            if (meta) meta.textContent = `${online} Online • ${running} Running`;

            if (overviewRow) {
                overviewRow.innerHTML = `
                    <div class="overview-card">
                        <div class="overview-top">
                            <div class="overview-icon"><span class="material-icons">devices</span></div>
                            <div class="overview-value">${online}</div>
                        </div>
                        <div class="overview-label">Total</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-top">
                            <div class="overview-icon overview-icon--bolt"><span class="material-icons">bolt</span></div>
                            <div class="overview-value">${running}</div>
                        </div>
                        <div class="overview-label">Active</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-top">
                            <div class="overview-icon overview-icon--accent"><span class="material-icons">lightbulb</span></div>
                            <div class="overview-value">${lightsOn}</div>
                        </div>
                        <div class="overview-label">Lights</div>
                    </div>
                `;
            }

            try {
                sessionStorage.setItem(overviewKey, JSON.stringify({ online, running, lightsOn, security: 'OK' }));
            } catch (_) { }
        };

        window.addEventListener('thynco_home_changed', render);
        window.addEventListener('thynco_home_device_updated', render);
        window.addEventListener('thynco_home_device_added', render);
        window.addEventListener('thynco_home_device_removed', render);
        render();

        return { render };
    };

    const initAddHomePage = () => {
        const name = document.querySelector('[data-add-home-name]');
        const id = document.querySelector('[data-add-home-id]');
        const saveBtn = document.querySelector('[data-add-home-save]');
        const useLoc = document.querySelector('[data-add-home-use-location]');
        const locStatus = document.querySelector('[data-add-home-location-status]');
        const clearLoc = document.querySelector('[data-add-home-clear-location]');

        if (!name || !id || !saveBtn) return null;

        const homesKey = 'thynco_homes_v1';
        const activeKey = 'thynco_active_home_v1';

        const normalizeId = (s) => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        let idDirty = false;
        let coords = null;

        const loadHomes = () => {
            try {
                const raw = localStorage.getItem(homesKey);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        };

        const saveHomes = (homes) => {
            try { localStorage.setItem(homesKey, JSON.stringify(homes)); } catch (_) { }
        };

        const upsertHome = (h) => {
            HomeManager.upsertHome(h);
        };

        const goBack = () => {
            if (history.length > 1) history.back();
            else location.href = 'index.html';
        };

        const setLocStatus = (t) => {
            if (locStatus) locStatus.textContent = t;
            if (clearLoc) clearLoc.style.display = coords ? 'inline-flex' : 'none';
        };

        name.addEventListener('input', () => {
            if (idDirty) return;
            const v = normalizeId(name.value);
            if (v) id.value = v;
        });

        id.addEventListener('input', () => {
            idDirty = true;
        });

        useLoc?.addEventListener('click', () => {
            if (!navigator.geolocation) return;
            try {
                navigator.geolocation.getCurrentPosition((p) => {
                    coords = { lat: p.coords.latitude, lng: p.coords.longitude };
                    setLocStatus('Location set');
                }, () => {
                    setLocStatus('Location unavailable');
                }, { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 });
            } catch (_) { }
        });

        clearLoc?.addEventListener('click', () => {
            coords = null;
            setLocStatus('Not set');
        });

        saveBtn.addEventListener('click', () => {
            const homeName = (name.value || '').toString().trim();
            if (!homeName) {
                name.focus({ preventScroll: true });
                return;
            }

            const homeId = normalizeId(id.value) || normalizeId(homeName);
            if (!homeId) {
                id.focus({ preventScroll: true });
                return;
            }
            if (!id.value) id.value = homeId;

            const next = { id: homeId, name: homeName };
            if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
                next.lat = coords.lat;
                next.lng = coords.lng;
            }

            upsertHome(next);
            try { localStorage.setItem(activeKey, homeId); } catch (_) { }
            goBack();
        });

        setLocStatus('Not set');
        return {};
    };

    const createAssistantUI = (root) => {
        const chat = root.querySelector('[data-assistant-chat]');
        const chips = root.querySelector('[data-assistant-chips]');
        const form = root.querySelector('[data-assistant-form]');
        const input = root.querySelector('[data-assistant-input]');
        const close = root.querySelector('[data-assistant-close]');
        const mic = root.querySelector('[data-assistant-mic]');
        const voiceBar = root.querySelector('[data-assistant-voicebar]');
        const voiceHint = root.querySelector('[data-assistant-voice-hint]');
        const status = root.querySelector('[data-assistant-status]');

        if (!chat || !chips || !form || !input) return null;

        const key = 'thynco_assistant_messages_v2';
        const normalize = (s) => (s || '').toString().trim().toLowerCase();
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        let listening = false;
        let textMode = false;
        const placeholderTyping = 'Type a message (Enter to send)';

        const setStatus = (t) => {
            if (status) status.textContent = t;
        };

        const syncHint = () => {
            if (!voiceHint) return;
            if (textMode) {
                voiceHint.textContent = '';
                return;
            }
            voiceHint.textContent = listening ? 'Listening…' : 'Tap to speak';
        };

        const setTextMode = (on) => {
            textMode = !!on;
            root.classList.toggle('assistant-text-mode', textMode);
            if (textMode) {
                setListening(false);
                input.removeAttribute('readonly');
                if (!input.placeholder) input.placeholder = placeholderTyping;
                requestAnimationFrame(() => input.focus({ preventScroll: true }));
            } else {
                input.setAttribute('readonly', '');
                input.blur();
            }
            syncHint();
        };

        const setListening = (on) => {
            listening = !!on;
            root.classList.toggle('assistant-listening', listening);
            const icon = voiceBar?.querySelector('.material-icons');
            if (icon) icon.textContent = listening ? 'graphic_eq' : 'mic';
            setStatus(listening ? 'Listening…' : 'Ready • Local');
            syncHint();
        };

        const scrollToBottom = () => {
            chat.scrollTo({ top: chat.scrollHeight, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        };

        const save = (messages) => {
            try {
                sessionStorage.setItem(key, JSON.stringify(messages));
            } catch (_) { }
        };

        const load = () => {
            try {
                const raw = sessionStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
                
                // Default Automations
                const defaults = [
                    { id: 'auto_1', name: 'Good Morning', icon: 'wb_sunny', enabled: true, meta: '7:00 AM • Weekdays' },
                    { id: 'auto_2', name: 'Sleep Mode', icon: 'nightlight_round', enabled: false, meta: '11:00 PM • Daily' },
                    { id: 'auto_3', name: 'Movie Night', icon: 'movie', enabled: false, meta: '8:00 PM • Fri' },
                    { id: 'auto_4', name: 'Arrive Home', icon: 'home', enabled: true, meta: 'When I arrive • Home' },
                    { id: 'auto_5', name: 'Leave Home', icon: 'logout', enabled: true, meta: 'When I leave • Home' },
                    { id: 'auto_6', name: 'Party Mode', icon: 'celebration', enabled: false, meta: 'Manual trigger' },
                    { id: 'auto_7', name: 'Security Alert', icon: 'shield', enabled: true, meta: 'Any motion • 11PM-6AM' }
                ];
                sessionStorage.setItem(key, JSON.stringify(defaults));
                return defaults;
            } catch (_) {
                return [];
            }
        };

        const el = (tag, className, text) => {
            const n = document.createElement(tag);
            if (className) n.className = className;
            if (typeof text === 'string') n.textContent = text;
            return n;
        };

        const appendMessage = (role, text, extras = {}) => {
            const wrap = el('div', `assistant-msg ${role === 'user' ? 'user' : 'ai'}`);
            const bubble = el('div', 'assistant-bubble google-card');
            bubble.textContent = text;
            wrap.appendChild(bubble);

            if (extras.actions?.length) {
                const row = el('div', 'assistant-actions');
                extras.actions.forEach(a => {
                    const b = el('button', 'assistant-action', a.label);
                    b.type = 'button';
                    b.addEventListener('click', () => {
                        if (a.href) location.href = a.href;
                        if (typeof a.onClick === 'function') a.onClick();
                    });
                    row.appendChild(b);
                });
                wrap.appendChild(row);
            }

            chat.appendChild(wrap);
            scrollToBottom();
        };

        const setChips = (items) => {
            chips.innerHTML = '';
            items.forEach(label => {
                const b = el('button', 'assistant-chip', label);
                b.type = 'button';
                b.addEventListener('click', () => {
                    setTextMode(true);
                    input.value = label;
                    input.focus({ preventScroll: true });
                });
                chips.appendChild(b);
            });
        };

        const parseRoom = (text) => {
            const t = normalize(text);
            if (t.includes('living') || t.includes('客厅')) return 'living';
            if (t.includes('kitchen') || t.includes('厨房')) return 'kitchen';
            if (t.includes('entry') || t.includes('门口') || t.includes('玄关') || t.includes('front')) return 'entry';
            return 'all';
        };

        const buildDevicesHref = ({ room, q }) => {
            const params = new URLSearchParams();
            if (room && room !== 'all') params.set('room', room);
            if (q) params.set('q', q);
            const qs = params.toString();
            return `devices.html${qs ? `?${qs}` : ''}`;
        };

        const replyFor = (raw) => {
            const t = normalize(raw);
            const room = parseRoom(raw);

            const goDevices = (q) => ({
                label: 'Go to Devices',
                href: buildDevicesHref({ room, q })
            });

            if (!t) {
                return {
                    text: 'What would you like me to do? Try “turn on living room lights” or “show device status”.',
                    actions: [goDevices('')]
                };
            }

            if (t.includes('设备') || t.includes('devices') || t.includes('device')) {
                return { text: 'Opening your devices list.', actions: [goDevices('')] };
            }

            if (t.includes('场景') || t.includes('scenes') || t.includes('scene')) {
                return { text: 'Taking you to Scenes.', actions: [{ label: 'Go to Scenes', href: 'scenes.html' }] };
            }

            if (t.includes('用户') || t.includes('profile') || t.includes('我')) {
                return { text: 'Opening your profile.', actions: [{ label: 'Go to Profile', href: 'user.html' }] };
            }

            const wantsLightsOn = /(打开|开启|turn on|on).*(灯|light)/i.test(raw);
            const wantsLightsOff = /(关闭|关掉|turn off|off).*(灯|light)/i.test(raw);
            if (wantsLightsOn || wantsLightsOff) {
                const q = room === 'kitchen' ? 'Ceiling' : 'Main Lights';
                return {
                    text: `Got it — I’ll take you to the relevant light controls${room === 'all' ? '' : ' for that room'}.`,
                    actions: [goDevices(q)]
                };
            }

            const mTemp = raw.match(/(\d{2})\s*([cC]|°)\b/) || raw.match(/温度\s*(\d{2})/);
            if (mTemp) {
                const v = mTemp[1];
                return {
                    text: `Taking you to the thermostat controls (target ${v}°C).`,
                    actions: [goDevices('Thermostat')]
                };
            }

            if (t.includes('门') || t.includes('lock') || t.includes('门锁')) {
                return { text: 'Taking you to the door lock controls.', actions: [goDevices('Front Door')] };
            }

            if (t.includes('摄像') || t.includes('camera') || t.includes('监控')) {
                return { text: 'Taking you to the camera controls.', actions: [goDevices('Camera')] };
            }

            if (t.includes('电影') || t.includes('movie') || t.includes('影院')) {
                return {
                    text: 'Movie mode: I can jump you to lights and TV controls.',
                    actions: [goDevices('Main Lights'), goDevices('TV Hub')]
                };
            }

            return {
                text: 'I can help control lights, temperature, locks, and cameras — or quickly jump to Devices and Scenes.',
                actions: [goDevices(''), { label: 'Go to Scenes', href: 'scenes.html' }]
            };
        };

        const renderFromStorage = () => {
            chat.innerHTML = '';
            const messages = load();
            messages.forEach(m => appendMessage(m.role, m.text, m.extras || {}));
            return messages;
        };

        const bootstrap = () => {
            const messages = renderFromStorage();
            const hasChinese = messages.some(m => /[\u4e00-\u9fff]/.test(m?.text || ''));
            if (hasChinese) {
                save([]);
                chat.innerHTML = '';
            }

            if (messages.length === 0 || hasChinese) {
                appendMessage('ai', 'Hi — I’m Thynco AI. I can help control devices, check status, and jump into scenes.');
                save([{ role: 'ai', text: 'Hi — I’m Thynco AI. I can help control devices, check status, and jump into scenes.', extras: {} }]);
            }

            // setChips(['Turn on living room lights', 'Set temperature to 24°C', 'Show device status', 'Open entry camera']);
            setStatus('Ready • Local');
            setTextMode(false);

            input.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                form.requestSubmit?.();
            });

            let pressTimer = null;
            const clearPress = () => {
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = null;
            };

            if (voiceBar) {
                voiceBar.addEventListener('click', () => {
                    setTextMode(false);
                    setListening(!listening);
                });
                voiceBar.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setTextMode(false);
                        setListening(!listening);
                    }
                });
                voiceBar.addEventListener('pointerdown', () => {
                    clearPress();
                    pressTimer = setTimeout(() => {
                        setTextMode(true);
                    }, 520);
                });
                voiceBar.addEventListener('pointerup', clearPress);
                voiceBar.addEventListener('pointercancel', clearPress);
                voiceBar.addEventListener('pointerleave', clearPress);
            }

            if (mic) {
                mic.addEventListener('click', () => {
                    setTextMode(false);
                    setListening(false);
                });
            }

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = input.value.trim();
                if (!text) return;

                const messagesNow = load();
                appendMessage('user', text);
                messagesNow.push({ role: 'user', text, extras: {} });

                input.value = '';

                // Simulate processing...
                setTimeout(() => {
                    const successText = `Done! I've successfully processed your request: "${text}". The operation was completed.`;
                    const r = {
                        text: successText,
                        actions: [{ label: 'View status', onClick: () => console.log('Viewing status...') }]
                    };
                    appendMessage('ai', r.text, { actions: r.actions || [] });
                    messagesNow.push({ role: 'ai', text: r.text, extras: { actions: r.actions || [] } });
                    save(messagesNow.slice(-40));
                }, 600);
                setTextMode(false);
                setListening(false);
            });
        };

        bootstrap();
        return { input, close, voiceBar, setListening, setTextMode };
    };

    const initAssistantOverlay = () => {
        const openers = Array.from(document.querySelectorAll('[data-assistant-open], .google-fab'));
        if (openers.length === 0) return null;

        if (!document.querySelector('[data-assistant-overlay]')) {
            const host = document.querySelector('#canvas-viewport') || document.querySelector('#app-content') || document.body;
            const wrap = document.createElement('div');
            wrap.innerHTML = `
                <div class="assistant-overlay" data-assistant-overlay aria-hidden="true">
                    <div class="assistant-overlay-backdrop" data-assistant-backdrop></div>
                    <div class="assistant-sheet" data-assistant-sheet role="dialog" aria-modal="true" aria-label="AI Assistant">
                        <div class="assistant-sheet-handle"></div>
                        <header class="assistant-sheet-head">
                            <div class="assistant-head">
                                <div class="assistant-head-text">
                                    <div class="assistant-title">AI Assistant</div>
                                </div>
                            </div>
                            <div class="assistant-sheet-actions">
                                <button type="button" class="circle-btn assistant-fullscreen" aria-label="Toggle Fullscreen" data-assistant-fullscreen>
                                    <span class="material-icons">fullscreen</span>
                                </button>
                                <button type="button" class="circle-btn assistant-close" aria-label="Close assistant" data-assistant-close>
                                    <span class="material-icons">close</span>
                                </button>
                            </div>
                        </header>

                        <div class="assistant-body">
                            <div class="assistant-chips" data-assistant-chips aria-label="Quick prompts"></div>
                            <div class="assistant-chat" data-assistant-chat role="log" aria-live="polite"></div>
                            <form class="assistant-composer" data-assistant-form>
                                <div class="assistant-input-container">
                                    <div class="assistant-input">
                                        <button type="button" class="assistant-voice-pill" aria-label="Voice input" data-assistant-voicebar>
                                            <div class="assistant-voice-pill-orb">
                                                <div class="assistant-voice-pill-orb-core"></div>
                                                <div class="assistant-voice-pill-orb-blob"></div>
                                            </div>
                                            <span class="assistant-voice-pill-text" data-assistant-voice-hint>Tap to speak</span>
                                        </button>
                                        <button type="button" class="assistant-mic-inline" aria-label="Back to voice" data-assistant-mic>
                                            <span class="material-icons">mic</span>
                                        </button>
                                        <input type="text" placeholder="Type a message (Enter to send)" aria-label="Message" autocomplete="off" data-assistant-input>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div class="assistant-sheet-glow" data-assistant-glow></div>
                </div>
            `.trim();
            host.appendChild(wrap.firstChild);
        }

        const overlay = document.querySelector('[data-assistant-overlay]');
        const backdrop = document.querySelector('[data-assistant-backdrop]');
        const sheet = document.querySelector('[data-assistant-sheet]');

        if (!overlay || !backdrop || !sheet) return null;

        let ui = null;
        let lastFocus = null;

        const isOpen = () => overlay.classList.contains('active');

        const close = () => {
            if (!isOpen()) return;
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
            ui?.setListening?.(false);
            ui?.setTextMode?.(false);
            lastFocus?.focus?.({ preventScroll: true });
            lastFocus = null;
        };

        const openFrom = (fromEl) => {
            if (isOpen()) return;
            lastFocus = fromEl || document.activeElement;

            const rect = sheet.getBoundingClientRect();
            const fromRect = (fromEl || sheet).getBoundingClientRect();
            const ox = (fromRect.left + fromRect.right) / 2 - rect.left;
            const oy = (fromRect.top + fromRect.bottom) / 2 - rect.top;
            sheet.style.setProperty('--origin-x', `${ox}px`);
            sheet.style.setProperty('--origin-y', `${oy}px`);

            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');

            if (!ui) ui = createAssistantUI(sheet);
            const focusVoice = () => ui?.voiceBar?.focus?.({ preventScroll: true });
            
            // Default to voice input on open
            setTimeout(() => {
                ui?.setTextMode?.(false);
                ui?.setListening?.(true);
            }, 500);

            requestAnimationFrame(() => focusVoice());
        };

        backdrop.addEventListener('click', close);
        sheet.querySelector('[data-assistant-close]')?.addEventListener('click', close);
        sheet.querySelector('[data-assistant-fullscreen]')?.addEventListener('click', () => {
            sheet.classList.toggle('fullscreen');
            const icon = sheet.querySelector('[data-assistant-fullscreen] .material-icons');
            if (icon) {
                icon.textContent = sheet.classList.contains('fullscreen') ? 'fullscreen_exit' : 'fullscreen';
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        openers.forEach(opener => {
            if (opener instanceof HTMLElement) {
                opener.removeAttribute('onclick');
                opener.setAttribute('role', 'button');
                opener.setAttribute('tabindex', opener.getAttribute('tabindex') || '0');
                opener.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openFrom(opener);
                });
                opener.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFrom(opener);
                    }
                });
            }
        });

        return { openFrom, close };
    };

    const getDeviceIconForType = (type) => {
        return {
            light: 'lightbulb',
            climate: 'thermostat',
            media: 'tv',
            sensor: 'sensors',
            lock: 'lock',
            camera: 'videocam'
        }[type] || 'devices';
    };

    const initDeviceDetailPage = () => {
        const stage = document.querySelector('#device');
        if (!stage) return null;

        const nameEl = stage.querySelector('[data-device-name]');
        const metaEl = stage.querySelector('[data-device-meta]');
        const iconEl = stage.querySelector('[data-device-icon]');
        const titleEl = stage.querySelector('[data-device-title]');
        const subtitleEl = stage.querySelector('[data-device-subtitle]');
        const controls = stage.querySelector('[data-device-controls]');
        const hero = stage.querySelector('[data-device-hero]');
        const missing = stage.querySelector('[data-device-missing]');
        if (!controls) return null;

        const normalize = (s) => (s || '').toString().trim().toLowerCase();
        const params = new URLSearchParams(location.search);
        const deviceId = params.get('deviceId') || params.get('device') || params.get('id') || '';
        const homeId = params.get('homeId') || params.get('home') || '';

        const getHome = () => {
            if (homeId) return HomeManager.getHome(homeId);
            return HomeManager.getHome(HomeManager.getActiveId());
        };

        const getStatusText = (d) => {
            const status = normalize(d.status);
            if (status === 'off' || status === '0') return `OFF • ${normalize(d.mode || 'STANDBY').toUpperCase()}`;
            if (d.type === 'light') return `${d.status}% • ${normalize(d.mode || 'WARM').toUpperCase()}`;
            if (d.type === 'climate') return `${normalize(d.mode || 'AUTO').toUpperCase()} • ${d.status}°C`;
            return `${status.toUpperCase()} • ${normalize(d.mode || 'OK').toUpperCase()}`;
        };

        const render = () => {
            const home = getHome();
            const device = home?.devices?.find(d => d.id === deviceId);
            const showMissing = !home || !device;

            if (missing) missing.hidden = !showMissing;
            if (hero) hero.hidden = showMissing;
            controls.hidden = showMissing;

            if (showMissing) {
                if (nameEl) nameEl.textContent = 'Device';
                if (metaEl) metaEl.textContent = '—';
                if (iconEl) iconEl.textContent = 'devices';
                if (titleEl) titleEl.textContent = '—';
                if (subtitleEl) subtitleEl.textContent = '—';
                controls.innerHTML = '';
                return;
            }

            const room = (home.rooms || []).find(r => r.id === device.room);
            const roomName = room?.name || home.name || 'Home';
            const onlineText = device.isOnline === false ? 'Offline' : 'Online';
            const statusText = getStatusText(device);

            if (nameEl) nameEl.textContent = device.name;
            if (metaEl) metaEl.textContent = `${roomName} • ${onlineText}`;
            if (iconEl) iconEl.textContent = getDeviceIconForType(device.type);
            if (titleEl) titleEl.textContent = device.name;
            if (subtitleEl) subtitleEl.textContent = statusText;

            const numericStatus = Number(device.status);
            const hasNumeric = Number.isFinite(numericStatus);
            const lightValue = Math.max(0, Math.min(100, hasNumeric ? numericStatus : 0));
            const climateValue = Math.max(16, Math.min(30, hasNumeric ? numericStatus : 24));

            controls.innerHTML = `
                <div class="control-card">
                    <div class="control-head">
                        <div class="control-title">Status</div>
                        <div class="control-value">${device.status}</div>
                    </div>
                    <div class="modes-row">
                        <button type="button" class="mode-chip ${normalize(device.status) !== 'off' && device.status !== '0' ? 'active' : ''}" data-device-action="on">On / Active</button>
                        <button type="button" class="mode-chip ${normalize(device.status) === 'off' || device.status === '0' ? 'active' : ''}" data-device-action="off">Off / Standby</button>
                    </div>
                </div>
                ${device.type === 'light' ? `
                    <div class="control-card">
                        <div class="control-head">
                            <div class="control-title">Brightness</div>
                            <div class="control-value"><span data-range-value>${lightValue}%</span></div>
                        </div>
                        <input type="range" class="range" min="0" max="100" step="1" value="${lightValue}" data-device-range="light">
                    </div>
                ` : ''}
                ${device.type === 'climate' ? `
                    <div class="control-card">
                        <div class="control-head">
                            <div class="control-title">Temperature</div>
                            <div class="control-value"><span data-range-value>${climateValue}°C</span></div>
                        </div>
                        <input type="range" class="range" min="16" max="30" step="1" value="${climateValue}" data-device-range="climate">
                    </div>
                ` : ''}
                <div class="control-card">
                    <div class="control-head">
                        <div class="control-title">Info</div>
                        <div class="control-value">${onlineText.toUpperCase()}</div>
                    </div>
                    <div class="device-info-rows">
                        <div class="device-info-row">
                            <div class="device-info-label">Room</div>
                            <div class="device-info-value">${roomName}</div>
                        </div>
                        <div class="device-info-row">
                            <div class="device-info-label">Type</div>
                            <div class="device-info-value">${normalize(device.type).toUpperCase()}</div>
                        </div>
                        <div class="device-info-row">
                            <div class="device-info-label">Device ID</div>
                            <div class="device-info-value">${device.id}</div>
                        </div>
                    </div>
                </div>
            `.trim();

            controls.querySelectorAll('[data-device-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const isOn = btn.dataset.deviceAction === 'on';
                    const nextStatus = isOn
                        ? (device.type === 'light' ? '80' : (device.type === 'climate' ? '24' : 'On'))
                        : (device.type === 'light' || device.type === 'climate' ? '0' : 'Off');
                    HomeManager.updateDevice(home.id, device.id, { status: nextStatus });
                });
            });

            controls.querySelectorAll('[data-device-range]').forEach(input => {
                if (!(input instanceof HTMLInputElement)) return;
                const kind = input.dataset.deviceRange;
                const valueEl = input.closest('.control-card')?.querySelector('[data-range-value]');
                const sync = () => {
                    const v = Number(input.value);
                    if (valueEl) valueEl.textContent = kind === 'climate' ? `${v}°C` : `${v}%`;
                };
                input.addEventListener('input', () => {
                    sync();
                    HomeManager.updateDevice(home.id, device.id, { status: input.value });
                });
                input.addEventListener('change', () => {
                    sync();
                    HomeManager.updateDevice(home.id, device.id, { status: input.value });
                });
                sync();
            });
        };

        const maybeRender = (e) => {
            const id = e?.detail?.homeId;
            if (homeId && id && id !== homeId) return;
            const changedId = e?.detail?.id;
            if (changedId && deviceId && changedId !== deviceId) return;
            render();
        };

        window.addEventListener('thynco_home_changed', render);
        window.addEventListener('thynco_home_device_updated', maybeRender);
        window.addEventListener('thynco_home_device_removed', maybeRender);
        window.addEventListener('thynco_home_device_added', maybeRender);

        render();
        return { render };
    };

    const initAddDevicePage = () => {
        const stage = document.querySelector('#add-device');
        if (!stage) return null;

        const scanBtn = stage.querySelector('[data-add-device-scan]');
        const manualAddBtn = stage.querySelector('[data-add-device-manual-add]');

        const modeBtns = Array.from(stage.querySelectorAll('[data-add-device-mode]'));
        const panels = Array.from(stage.querySelectorAll('[data-add-device-panel]'));

        const autoOrb = stage.querySelector('[data-auto-orb]');
        const autoTitle = stage.querySelector('[data-auto-title]');
        const autoSub = stage.querySelector('[data-auto-sub]');
        const autoSearchBtn = stage.querySelector('[data-auto-search]');
        const autoResults = stage.querySelector('[data-auto-results]');
        const discoverList = stage.querySelector('[data-discover-list]');
        const discoverEmpty = stage.querySelector('[data-discover-empty]');

        const name = stage.querySelector('[data-add-device-name]');
        const type = stage.querySelector('[data-add-device-type]');

        if (!scanBtn || !autoTitle || !autoSub || !discoverList) return null;

        const params = new URLSearchParams(location.search);
        const homeId = params.get('homeId') || params.get('home') || '';
        const overlayKey = 'thynco_nav_transition_v1';
        const normalize = (s) => (s || '').toString().trim();

        const getHome = () => {
            if (homeId) return HomeManager.getHome(homeId);
            return HomeManager.getHome(HomeManager.getActiveId());
        };

        const ensureRooms = () => {
            const home = getHome();
            if (!home) return null;
            if (Array.isArray(home.rooms) && home.rooms.length) return home;
            HomeManager.addRoom(home.id, { name: 'General' });
            return HomeManager.getHome(home.id);
        };

        const goBack = () => {
            try { sessionStorage.setItem(overlayKey, '1'); } catch (_) { }
            if (history.length > 1) history.back();
            else location.href = 'devices.html';
        };

        const defaultsForType = (t) => {
            const v = (t || '').toString();
            if (v === 'light') return { status: '0', mode: 'Warm' };
            if (v === 'climate') return { status: '24', mode: 'Auto' };
            if (v === 'media') return { status: 'Off', mode: 'Ready' };
            if (v === 'lock') return { status: 'Locked', mode: 'Secure' };
            if (v === 'camera') return { status: 'On', mode: 'Live' };
            if (v === 'sensor') return { status: 'OK', mode: 'Normal' };
            return { status: 'Off', mode: 'OK' };
        };

        const scanKey = 'thynco_add_device_scan_v1';
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        let mode = 'auto';
        let scanTimer = null;

        const isMode = (m) => mode === m;

        const setMode = (m) => {
            mode = m === 'manual' ? 'manual' : 'auto';
            modeBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-add-device-mode') === mode));
            panels.forEach(p => p.classList.toggle('active', p.getAttribute('data-add-device-panel') === mode));
            if (mode === 'manual') {
                requestAnimationFrame(() => name?.focus?.({ preventScroll: true }));
            } else {
                const wasScanned = (() => {
                    try { return sessionStorage.getItem(scanKey) === '1'; } catch (_) { return false; }
                })();
                if (!wasScanned) startScan();
            }
        };

        const buildDiscovery = () => {
            const pool = [
                { name: 'Desk Lamp', type: 'light', signal: 'Strong' },
                { name: 'Thermostat', type: 'climate', signal: 'Good' },
                { name: 'TV Hub', type: 'media', signal: 'Good' },
                { name: 'Front Door Lock', type: 'lock', signal: 'Strong' },
                { name: 'Indoor Cam', type: 'camera', signal: 'Fair' },
                { name: 'Motion Sensor', type: 'sensor', signal: 'Fair' }
            ];
            const seed = Date.now() % 997;
            const take = 2 + (seed % 3);
            const picked = [];
            for (let i = 0; i < pool.length; i++) {
                const idx = (seed + i * 37) % pool.length;
                if (!picked.some(x => x.name === pool[idx].name)) picked.push(pool[idx]);
                if (picked.length >= take) break;
            }
            return picked.map((d, i) => ({ ...d, tmpId: `scan_${Date.now()}_${i}` }));
        };

        const renderDiscoverList = (items) => {
            discoverList.innerHTML = items.map(d => `
                <div class="discover-item" data-discover-item="${d.tmpId}">
                    <div class="discover-icon">
                        <span class="material-icons">${getDeviceIconForType(d.type)}</span>
                    </div>
                    <div class="discover-info">
                        <h4>${d.name}</h4>
                        <p>${d.type.toUpperCase()} • ${d.signal}</p>
                    </div>
                    <button type="button" class="discover-add" data-discover-add="${d.tmpId}">Add</button>
                </div>
            `).join('');

            if (!prefersReducedMotion && autoOrb) {
                try {
                    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
                    const from = autoOrb.getBoundingClientRect();
                    const fromCx = from.left + from.width / 2;
                    const fromCy = from.top + from.height / 2;
                    const nodes = Array.from(discoverList.querySelectorAll('.discover-item'));
                    nodes.forEach((node, idx) => {
                        const r = node.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const dx = clamp(fromCx - cx, -220, 220);
                        const dy = clamp(fromCy - cy, -220, 220);
                        node.style.setProperty('--from-x', `${dx}px`);
                        node.style.setProperty('--from-y', `${dy}px`);
                        node.style.setProperty('--rot', `${(-6 + (Math.random() * 12)).toFixed(2)}deg`);
                        node.classList.remove('emerge');
                        setTimeout(() => node.classList.add('emerge'), 20 + idx * 80);
                    });
                    autoOrb.classList.remove('emit');
                    setTimeout(() => autoOrb.classList.add('emit'), 10);
                    setTimeout(() => autoOrb.classList.remove('emit'), 620);
                } catch (_) { }
            }

            if (!prefersReducedMotion && autoResults) {
                autoResults.classList.remove('reveal');
                requestAnimationFrame(() => autoResults.classList.add('reveal'));
            }

            discoverList.querySelectorAll('[data-discover-add]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const home = ensureRooms();
                    if (!home) return;
                    const roomId = home.rooms[0].id;
                    const id = btn.getAttribute('data-discover-add');
                    const found = items.find(x => x.tmpId === id);
                    if (!found) return;
                    const defaults = defaultsForType(found.type);
                    const ok = HomeManager.addDevice(home.id, { name: found.name, type: found.type, room: roomId, mode: defaults.mode, status: defaults.status });
                    if (!ok) return;
                    
                    // Navigate to setup page
                    const url = `setup-device.html?name=${encodeURIComponent(found.name)}&type=${encodeURIComponent(found.type)}`;
                    try { sessionStorage.setItem(overlayKey, '1'); } catch (_) { }
                    location.href = url;
                });
            });
        };

        const startScan = () => {
            if (!isMode('auto')) return;
            if (scanTimer) clearTimeout(scanTimer);
            try { sessionStorage.setItem(scanKey, '1'); } catch (_) { }
            discoverList.innerHTML = '';
            if (discoverEmpty) discoverEmpty.hidden = true;
            autoResults?.classList.remove('reveal');
            if (autoOrb) autoOrb.classList.add('is-scanning');
            scanBtn.classList.add('on');
            autoTitle.textContent = 'Searching nearby devices…';
            const delay = prefersReducedMotion ? 200 : 1200;
            scanTimer = setTimeout(() => {
                if (!isMode('auto')) return;
                if (autoOrb) autoOrb.classList.remove('is-scanning');
                scanBtn.classList.remove('on');
                const items = buildDiscovery();
                if (!items.length) {
                    if (discoverEmpty) discoverEmpty.hidden = false;
                    autoTitle.textContent = 'No devices found';
                    discoverList.innerHTML = '';
                    return;
                }
                autoTitle.textContent = 'Nearby Devices';
                renderDiscoverList(items);
            }, delay);
        };

        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const next = btn.getAttribute('data-add-device-mode') || 'auto';
                setMode(next);
            });
        });

        autoSearchBtn?.addEventListener('click', () => startScan());

        scanBtn.addEventListener('click', () => {
            setMode('auto');
            startScan();
        });

        manualAddBtn?.addEventListener('click', () => {
            const home = ensureRooms();
            if (!home) return;
            const deviceName = normalize(name?.value);
            if (!deviceName) {
                name?.focus?.({ preventScroll: true });
                return;
            }
            const deviceType = (type?.value || '').toString();
            const roomId = home.rooms[0].id;
            const defaults = defaultsForType(deviceType);
            const ok = HomeManager.addDevice(home.id, { name: deviceName, type: deviceType, room: roomId, mode: defaults.mode, status: defaults.status });
            if (ok) goBack();
        });

        name?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            manualAddBtn?.click?.();
        });

        window.addEventListener('thynco_home_changed', () => {
            // Room rendering removed
        });

        setMode('auto');
        startScan();
        return {};
    };

    const initDevicesPage = () => {
        const viewport = document.querySelector('#canvas-viewport');
        const roomStrip = document.querySelector('[data-room-strip]');
        const sectionsContainer = document.querySelector('#device-sections-container');
        const searchInput = document.querySelector('[data-devices-search]');
        const overviewKey = 'thynco_device_overview_v1';
        const sheetOverlay = document.querySelector('[data-sheet-overlay]');
        const sheet = document.querySelector('[data-device-sheet]');
        const sheetIcon = document.querySelector('[data-sheet-icon]');
        const sheetTitle = document.querySelector('[data-sheet-title]');
        const sheetSubtitle = document.querySelector('[data-sheet-subtitle]');
        const sheetControls = document.querySelector('[data-sheet-controls]');
        const sheetClose = document.querySelector('[data-sheet-close]');
        const sheetFull = document.querySelector('[data-sheet-fullscreen]');
        const sheetFullIcon = document.querySelector('[data-sheet-fullscreen-icon]');

        if (!roomStrip && !sectionsContainer) return null;

        let activeRoomId = 'all';
        let query = '';
        let lastFocusedTile = null;
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        const normalize = (s) => (s || '').toString().trim().toLowerCase();

        const getActiveHome = () => HomeManager.getHome(HomeManager.getActiveId());

        const render = () => {
            const home = getActiveHome();
            if (!home) return;

            // Render Room Pills
            roomStrip.innerHTML = `
                <button type="button" class="room-pill ${activeRoomId === 'all' ? 'active' : ''}" data-room-filter="all">All</button>
                ${(home.rooms || []).map(r => `
                    <button type="button" class="room-pill ${activeRoomId === r.id ? 'active' : ''}" data-room-filter="${r.id}">${r.name}</button>
                `).join('')}
            `;

            // Group devices by room
            const devicesByRoom = {};
            const allRooms = [{ id: 'all', name: 'ALL' }, ...(home.rooms || [])];
            
            home.devices.forEach(d => {
                if (!devicesByRoom[d.room]) devicesByRoom[d.room] = [];
                devicesByRoom[d.room].push(d);
            });

            // Render Sections
            sectionsContainer.innerHTML = allRooms.map(r => {
                if (r.id === 'all') return '';
                const devices = devicesByRoom[r.id] || [];
                const filtered = devices.filter(d => {
                    const matchesRoom = activeRoomId === 'all' || activeRoomId === r.id;
                    const matchesQuery = !query || [d.name, d.type, d.status].some(v => normalize(v).includes(query));
                    return matchesRoom && matchesQuery;
                });

                if (filtered.length === 0 && activeRoomId !== 'all' && activeRoomId !== r.id) return '';
                if (filtered.length === 0 && query) return '';

                return `
                    <div class="device-section" data-room="${r.id}">
                        <div class="sec-label">
                            <h3>${r.name.toUpperCase()}</h3>
                        </div>
                        <div class="unit-grid">
                            ${filtered.map(d => {
                                const isOn = normalize(d.status) !== 'off' && d.status !== '0';
                                return `
                                <div class="unit-tile google-card ${isOn ? 'active' : ''}" 
                                     data-device-id="${d.id}" data-type="${d.type}" role="button" tabindex="0">
                                    <div class="unit-top">
                                        <div class="unit-icon">
                                            <span class="material-icons">${getDeviceIconForType(d.type)}</span>
                                        </div>
                                        <div class="md3-switch ${isOn ? 'on' : ''}" data-device-toggle="${d.id}"></div>
                                    </div>
                                    <div class="unit-bottom">
                                        <h4>${d.name}</h4>
                                        <p>${getStatusText(d)}</p>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            attachTileEvents();
            attachPillEvents();
            updateOverview();
        };

        const getStatusText = (d) => {
            const status = normalize(d.status);
            if (status === 'off' || status === '0') return `OFF • ${normalize(d.mode || 'STANDBY').toUpperCase()}`;
            if (d.type === 'light') return `${d.status}% • ${normalize(d.mode || 'WARM').toUpperCase()}`;
            if (d.type === 'climate') return `${normalize(d.mode || 'AUTO').toUpperCase()} • ${d.status}°C`;
            return `${status.toUpperCase()} • ${normalize(d.mode || 'OK').toUpperCase()}`;
        };

        const attachTileEvents = () => {
            sectionsContainer.querySelectorAll('[data-device-id]').forEach(tile => {
                const id = tile.dataset.deviceId;
                const home = getActiveHome();
                const device = home.devices.find(d => d.id === id);
                if (!device) return;

                const sw = tile.querySelector('[data-device-toggle]');
                if (sw) {
                    sw.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const nextOn = !sw.classList.contains('on');
                        HomeManager.updateDevice(home.id, device.id, { 
                            status: nextOn ? (device.type === 'light' ? '80' : (device.type === 'climate' ? '24' : 'On')) : 'Off' 
                        });
                    });
                }

                tile.addEventListener('click', () => {
                    openSheet(device, tile);
                });
            });
        };

        const attachPillEvents = () => {
            roomStrip.querySelectorAll('[data-room-filter]').forEach(pill => {
                pill.addEventListener('click', () => {
                    activeRoomId = pill.dataset.roomFilter;
                    render();
                });
            });
        };

        const updateOverview = () => {
            const home = getActiveHome();
            if (!home) return;
            const online = home.devices.length;
            const running = home.devices.filter(d => normalize(d.status) !== 'off' && d.status !== '0').length;
            const lightsOn = home.devices.filter(d => d.type === 'light' && normalize(d.status) !== 'off' && d.status !== '0').length;
            
            const meta = document.querySelector('[data-devices-meta]');
            if (meta) meta.textContent = `${online} Online • ${running} Running`;

            const overviewRow = document.querySelector('[data-devices-overview]');
            if (overviewRow) {
                overviewRow.innerHTML = `
                    <div class="overview-card">
                        <div class="overview-top">
                            <div class="overview-icon"><span class="material-icons">devices</span></div>
                            <div class="overview-value">${online}</div>
                        </div>
                        <div class="overview-label">Total</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-top">
                            <div class="overview-icon overview-icon--bolt"><span class="material-icons">bolt</span></div>
                            <div class="overview-value">${running}</div>
                        </div>
                        <div class="overview-label">Active</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-top">
                            <div class="overview-icon overview-icon--accent"><span class="material-icons">lightbulb</span></div>
                            <div class="overview-value">${lightsOn}</div>
                        </div>
                        <div class="overview-label">Lights</div>
                    </div>
                `;
            }

            try {
                sessionStorage.setItem(overviewKey, JSON.stringify({ online, running, lightsOn, security: 'OK' }));
            } catch (_) { }
        };

        const openSheet = (device, tile) => {
            if (!sheetOverlay || !sheet || !sheetControls) return;
            lastFocusedTile = tile;
            sheet.classList.remove('is-fullscreen');
            sheet.style.removeProperty('--fs-tx');
            sheet.style.removeProperty('--fs-ty');
            sheet.style.removeProperty('--fs-sx');
            sheet.style.removeProperty('--fs-sy');
            if (sheetFullIcon) sheetFullIcon.textContent = 'fullscreen';

            sheetIcon.textContent = getDeviceIconForType(device.type);
            sheetTitle.textContent = device.name;
            const home = getActiveHome();
            const room = home.rooms.find(r => r.id === device.room);
            if (sheetSubtitle) sheetSubtitle.textContent = `${room?.name || 'Home'} • ${device.status} • ${device.mode || 'Auto'}`;
            const deviceHref = `device.html?homeId=${encodeURIComponent(home.id)}&deviceId=${encodeURIComponent(device.id)}`;

            // Simplified controls rendering for demo
            sheetControls.innerHTML = `
                <div class="control-card">
                    <div class="control-head">
                        <div class="control-title">Status</div>
                        <div class="control-value">${device.status}</div>
                    </div>
                    <div class="modes-row">
                        <button type="button" class="mode-chip ${normalize(device.status) !== 'off' ? 'active' : ''}" data-action="on">On / Active</button>
                        <button type="button" class="mode-chip ${normalize(device.status) === 'off' ? 'active' : ''}" data-action="off">Off / Standby</button>
                    </div>
                </div>
                <div class="control-card">
                    <div class="control-head">
                        <div class="control-title">Details</div>
                        <div class="control-value">${normalize(device.type).toUpperCase()}</div>
                    </div>
                    <div class="sheet-actions">
                        <button type="button" class="sheet-primary-btn" data-nav-to="${deviceHref}">Open device page</button>
                    </div>
                </div>
            `;

            sheetControls.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const isOn = btn.dataset.action === 'on';
                    HomeManager.updateDevice(home.id, device.id, { 
                        status: isOn ? (device.type === 'light' ? '80' : (device.type === 'climate' ? '24' : 'On')) : 'Off' 
                    });
                    closeSheet();
                });
            });

            sheetOverlay.classList.add('active');
            sheet.classList.add('active');
            sheet.setAttribute('aria-hidden', 'false');
            viewport?.classList.add('sheet-open');
            sheetClose?.focus?.({ preventScroll: true });
        };

        const closeSheet = () => {
            sheetOverlay.classList.remove('active');
            sheet.classList.remove('active');
            sheet?.setAttribute('aria-hidden', 'true');
            viewport?.classList.remove('sheet-open');
            sheet?.classList.remove('is-fullscreen');
            sheet?.style.removeProperty('--fs-tx');
            sheet?.style.removeProperty('--fs-ty');
            sheet?.style.removeProperty('--fs-sx');
            sheet?.style.removeProperty('--fs-sy');
            if (sheetFullIcon) sheetFullIcon.textContent = 'fullscreen';
            lastFocusedTile?.focus?.({ preventScroll: true });
        };

        if (sheetClose) sheetClose.addEventListener('click', closeSheet);
        if (sheetOverlay) sheetOverlay.addEventListener('click', closeSheet);
        if (sheetFull) {
            sheetFull.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!sheet || !viewport) return;
                const surface = sheet.querySelector('.device-sheet-surface');
                if (!(surface instanceof HTMLElement)) return;

                const on = !sheet.classList.contains('is-fullscreen');
                if (!on) {
                    sheet.classList.remove('is-fullscreen');
                    sheet.style.removeProperty('--fs-tx');
                    sheet.style.removeProperty('--fs-ty');
                    sheet.style.removeProperty('--fs-sx');
                    sheet.style.removeProperty('--fs-sy');
                    if (sheetFullIcon) sheetFullIcon.textContent = 'fullscreen';
                    sheetFull.focus?.({ preventScroll: true });
                    return;
                }

                const v = viewport.getBoundingClientRect();
                const r = surface.getBoundingClientRect();
                const sx = v.width / r.width;
                const sy = v.height / r.height;
                const tx = (v.left - r.left);
                const ty = (v.top - r.top);
                sheet.style.setProperty('--fs-tx', `${tx}px`);
                sheet.style.setProperty('--fs-ty', `${ty}px`);
                sheet.style.setProperty('--fs-sx', `${sx}`);
                sheet.style.setProperty('--fs-sy', `${sy}`);
                sheet.classList.add('is-fullscreen');
                if (sheetFullIcon) sheetFullIcon.textContent = 'fullscreen_exit';
                sheetFull.focus?.({ preventScroll: true });
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sheet?.classList.contains('active')) closeSheet();
        });
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                query = normalize(searchInput.value);
                render();
            });
        }

        window.addEventListener('thynco_home_changed', render);
        window.addEventListener('thynco_home_device_updated', render);
        window.addEventListener('thynco_home_device_added', render);
        window.addEventListener('thynco_home_device_removed', render);

        render();

        return { render };
    };

    const initRoutinesPage = () => {
        const stage = document.querySelector('#scenes');
        const list = stage?.querySelector('[data-routines-list]');
        const countEl = stage?.querySelector('[data-routines-count]');
        const empty = stage?.querySelector('[data-routines-empty]');
        const subtitle = stage?.querySelector('[data-routines-subtitle]');
        const searchInput = stage?.querySelector('[data-routines-search]');
        const filters = Array.from(stage?.querySelectorAll('[data-routines-filter]') || []);
        const suggested = stage?.querySelector('[data-routines-suggested]');
        const suggestedLabel = stage?.querySelector('[data-routines-section="suggested-label"]');
        const personalLabel = stage?.querySelector('[data-routines-section="personal-label"]');

        if (!stage || !list) return null;

        const key = 'thynco_routines_v2';
        const normalize = (s) => (s || '').toString().trim().toLowerCase();
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        let activeFilter = 'all';
        let query = '';

        const load = () => {
            try {
                const raw = sessionStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        };

        const save = (items) => {
            try {
                sessionStorage.setItem(key, JSON.stringify(items));
            } catch (_) { }
        };

        const updateMeta = (routines) => {
            const suggestedCount = suggested?.querySelectorAll('.scene-card')?.length || 0;
            const personalCount = routines.length;
            if (subtitle) subtitle.textContent = `${suggestedCount} suggested • ${personalCount} personal`;
            if (countEl) countEl.textContent = `${personalCount}`;
        };

        const setSections = (mode) => {
            const showSuggested = mode === 'all' || mode === 'suggested';
            const showPersonal = mode === 'all' || mode === 'personal';
            suggested?.classList.toggle('is-hidden', !showSuggested);
            suggestedLabel?.classList.toggle('is-hidden', !showSuggested);
            personalLabel?.classList.toggle('is-hidden', !showPersonal);
            if (!showPersonal) {
                list?.classList.add('is-hidden');
                empty?.classList.add('is-hidden');
            }
        };

        const buildItem = (routine) => {
            const item = document.createElement('div');
            item.className = `routine-item google-card ${routine.enabled ? 'active' : ''}`;
            item.setAttribute('data-toggle-tile', '');
            item.setAttribute('data-routine-item', '');
            item.dataset.routineId = routine.id || '';

            const icon = (routine.icon || 'auto_awesome').toString();
            const title = (routine.name || 'Routine').toString();
            const meta = (() => {
                const raw = (routine.meta || '').toString().trim();
                if (raw) return raw;
                const c0 = Array.isArray(routine.conditions) ? routine.conditions[0] : null;
                const cTitle = (c0?.title || '').toString().trim();
                const cSub = (c0?.subtitle || '').toString().trim();
                const parts = [cTitle, cSub].filter(Boolean);
                if (parts.length) return parts.join(' • ');
                const tCount = Array.isArray(routine.tasks) ? routine.tasks.length : 0;
                if (tCount) return `${tCount} tasks`;
                return (routine.trigger || '').toString();
            })();

            item.innerHTML = `
                <div class="routine-item-left">
                    <div class="routine-badge routine-badge--primary">
                        <span class="material-icons">${icon}</span>
                    </div>
                    <div class="routine-item-info">
                        <h4>${title}</h4>
                        <p>${meta || '—'}</p>
                    </div>
                </div>
                <div class="md3-switch ${routine.enabled ? 'on' : ''}" aria-label="Toggle routine"></div>
            `;
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            return item;
        };

        const applyFilters = (routines) => {
            const q = normalize(query);
            const nodes = Array.from(list.querySelectorAll('[data-routine-item]'));
            nodes.forEach(node => {
                const t = normalize(node.querySelector('h4')?.textContent);
                const m = normalize(node.querySelector('p')?.textContent);
                const visible = !q || t.includes(q) || m.includes(q);
                node.classList.toggle('is-hidden', !visible);
            });

            const anyVisible = nodes.some(n => !n.classList.contains('is-hidden'));
            const showEmpty = routines.length === 0 || !anyVisible;
            empty?.classList.toggle('is-hidden', !showEmpty);
            list.classList.toggle('is-hidden', showEmpty);
        };

        const render = () => {
            const routines = load();
            list.innerHTML = '';
            routines.forEach(r => list.appendChild(buildItem(r)));
            updateMeta(routines);
            setSections(activeFilter);
            if (activeFilter !== 'suggested') applyFilters(routines);
        };

        if (filters.length) {
            filters.forEach(btn => {
                btn.addEventListener('click', () => {
                    activeFilter = btn.dataset.routinesFilter || 'all';
                    filters.forEach(b => b.classList.toggle('active', b === btn));
                    render();
                });
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                query = searchInput.value || '';
                render();
            });
        }

        list.addEventListener('click', (e) => {
            const tile = e.target.closest?.('[data-routine-item]');
            if (!tile) return;
            setTimeout(() => {
                const id = tile.dataset.routineId;
                if (!id) return;
                const items = load();
                const idx = items.findIndex(x => x.id === id);
                if (idx < 0) return;
                const enabled = tile.classList.contains('active');
                items[idx] = { ...items[idx], enabled };
                save(items);
                updateMeta(items);
                applyFilters(items);
            }, 0);
        }, true);

        render();
        const resetScroll = () => {
            try {
                stage.scrollTop = 0;
                stage.scrollTo?.({ top: 0, behavior: 'auto' });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                window.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
            } catch (_) { }
        };
        resetScroll();
        requestAnimationFrame(resetScroll);
        setTimeout(resetScroll, 0);
        window.addEventListener('pageshow', resetScroll);
        return { render };
    };

    const initRoutineBuilder = () => {
        const stage = document.querySelector('#create-routine');
        const nameInput = stage?.querySelector('[data-routine-name]');
        const triggersList = stage?.querySelector('[data-routine-triggers]');
        const actionsList = stage?.querySelector('[data-routine-actions]');
        const addTrigger = stage?.querySelector('[data-add-trigger]');
        const addAction = stage?.querySelector('[data-add-action]');
        const saveBottom = stage?.querySelector('[data-routine-primary-save]');

        const overlay = document.querySelector('[data-routine-sheet-overlay]');
        const sheet = document.querySelector('[data-routine-sheet]');
        const sheetIcon = document.querySelector('[data-routine-sheet-icon]');
        const sheetTitle = document.querySelector('[data-routine-sheet-title]');
        const sheetSubtitle = document.querySelector('[data-routine-sheet-subtitle]');
        const sheetOptions = document.querySelector('[data-routine-sheet-options]');
        const sheetClose = document.querySelector('[data-routine-sheet-close]');

        if (!stage || !nameInput || !triggersList || !actionsList) return null;

        const key = 'thynco_routines_v2';
        const normalize = (s) => (s || '').toString().trim().toLowerCase();
        const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        const templates = {
            morning: {
                name: 'Good Morning',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '07:00 • Weekdays', tone: 'time', config: { type: 'schedule', time: '07:00', repeat: 'weekdays' } },
                actions: [
                    { icon: 'lightbulb', title: 'Living Room Lights', subtitle: 'Turn On • 60% Brightness' },
                    { icon: 'local_cafe', title: 'Coffee Maker', subtitle: 'Start • 1 cup' }
                ]
            },
            leaving: {
                name: 'Leaving Home',
                trigger: { icon: 'location_on', title: 'Location', subtitle: 'Leave • Home • 200m', tone: 'location', config: { type: 'location', mode: 'leave', place: 'Home', radius: 200 } },
                actions: [
                    { icon: 'lock', title: 'Front Door', subtitle: 'Lock • Secure' },
                    { icon: 'lightbulb', title: 'All Lights', subtitle: 'Turn Off' }
                ]
            },
            movie: {
                name: 'Movie Night',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '20:00 • Weekdays', tone: 'time', config: { type: 'schedule', time: '20:00', repeat: 'weekdays' } },
                actions: [
                    { icon: 'lightbulb', title: 'Living Room Lights', subtitle: 'Turn On • 30% Brightness' },
                    { icon: 'tv', title: 'TV Hub', subtitle: 'Turn On • Launch Netflix' }
                ]
            },
            night: {
                name: 'Good Night',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '23:00 • Daily', tone: 'time', config: { type: 'schedule', time: '23:00', repeat: 'daily' } },
                actions: [
                    { icon: 'lightbulb', title: 'All Lights', subtitle: 'Dim • 10%' },
                    { icon: 'lock', title: 'Front Door', subtitle: 'Lock • Secure' }
                ]
            },
            arrival: {
                name: 'Arriving Home',
                trigger: { icon: 'location_on', title: 'Location', subtitle: 'Arrive • Home • 200m', tone: 'location', config: { type: 'location', mode: 'arrive', place: 'Home', radius: 200 } },
                actions: [
                    { icon: 'lightbulb', title: 'Entry Lights', subtitle: 'Turn On • 70% Brightness' },
                    { icon: 'thermostat', title: 'Thermostat', subtitle: 'Set • 24°C' }
                ]
            },
            away: {
                name: 'Away Mode',
                trigger: { icon: 'location_on', title: 'Location', subtitle: 'Leave • Home • 200m', tone: 'location', config: { type: 'location', mode: 'leave', place: 'Home', radius: 200 } },
                actions: [
                    { icon: 'lock', title: 'Front Door', subtitle: 'Lock • Secure' },
                    { icon: 'lightbulb', title: 'All Lights', subtitle: 'Turn Off' }
                ]
            },
            relax: {
                name: 'Relax',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '21:00 • Daily', tone: 'time', config: { type: 'schedule', time: '21:00', repeat: 'daily' } },
                actions: [
                    { icon: 'lightbulb', title: 'Living Room Lights', subtitle: 'Dim • 20%' },
                    { icon: 'tv', title: 'TV Hub', subtitle: 'Turn On • Ambient' }
                ]
            },
            clean: {
                name: 'Clean Up',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '18:00 • Weekdays', tone: 'time', config: { type: 'schedule', time: '18:00', repeat: 'weekdays' } },
                actions: [
                    { icon: 'cleaning_services', title: 'Robot Vacuum', subtitle: 'Start • Living room' },
                    { icon: 'lightbulb', title: 'All Lights', subtitle: 'Turn On • 80%' }
                ]
            },
            workout: {
                name: 'Workout',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '07:30 • Weekdays', tone: 'time', config: { type: 'schedule', time: '07:30', repeat: 'weekdays' } },
                actions: [
                    { icon: 'lightbulb', title: 'Bedroom Lights', subtitle: 'Turn On • 70%' },
                    { icon: 'speaker', title: 'Speaker', subtitle: 'Play • Workout mix' }
                ]
            },
            dinner: {
                name: 'Dinner Time',
                trigger: { icon: 'schedule', title: 'Schedule', subtitle: '19:00 • Daily', tone: 'time', config: { type: 'schedule', time: '19:00', repeat: 'daily' } },
                actions: [
                    { icon: 'lightbulb', title: 'Dining Lights', subtitle: 'Turn On • Warm' },
                    { icon: 'notifications', title: 'Notification', subtitle: 'Dinner is ready' }
                ]
            }
        };

        const TRIGGERS = [
            { key: 'manual', icon: 'play_arrow', title: 'Manually run', subtitle: 'Run when you tap', tone: 'time' },
            { key: 'schedule', icon: 'schedule', title: 'Schedule', subtitle: 'Time and repeat', tone: 'time' },
            { key: 'sun', icon: 'sunny', title: 'Sunrise / Sunset', subtitle: 'Based on city sun', tone: 'sun' },
            { key: 'weather', icon: 'cloud', title: 'Weather', subtitle: 'Temperature, humidity, air', tone: 'sun' },
            { key: 'location', icon: 'location_on', title: 'Location', subtitle: 'Arrive or leave', tone: 'location' },
            { key: 'device', icon: 'sensors', title: 'Device status', subtitle: 'When a device changes', tone: 'device' }
        ];

        const ACTIONS = [
            { key: 'device', icon: 'toggle_on', title: 'Control device', subtitle: 'Set device state' },
            { key: 'notification', icon: 'notifications', title: 'Send notification', subtitle: 'Push to phone' },
            { key: 'scene_trigger', icon: 'play_circle', title: 'Trigger routine', subtitle: 'Run another routine' },
            { key: 'scene_enable', icon: 'check_circle', title: 'Enable routine', subtitle: 'Turn on another routine' },
            { key: 'scene_disable', icon: 'block', title: 'Disable routine', subtitle: 'Turn off another routine' }
        ];

        const DEVICES = [
            { id: 'light_living', name: 'Living Room Lights', icon: 'lightbulb', kind: 'light', dps: [{ id: 'power', name: 'Power', type: 'bool' }, { id: 'brightness', name: 'Brightness', type: 'range', min: 1, max: 100 }] },
            { id: 'tv_hub', name: 'TV Hub', icon: 'tv', kind: 'media', dps: [{ id: 'power', name: 'Power', type: 'bool' }, { id: 'source', name: 'Source', type: 'enum', options: ['Netflix', 'HDMI 1', 'HDMI 2'] }] },
            { id: 'lock_front', name: 'Front Door', icon: 'lock', kind: 'lock', dps: [{ id: 'lock', name: 'Lock state', type: 'enum', options: ['Locked', 'Unlocked'] }] },
            { id: 'sensor_motion', name: 'Motion Sensor', icon: 'sensors', kind: 'sensor', dps: [{ id: 'motion', name: 'Motion', type: 'enum', options: ['Detected', 'Clear'] }] }
        ];

        const CITIES = ['Shanghai', 'Shenzhen', 'Hangzhou', 'Beijing', 'San Francisco'];

        const WEATHER_FIELDS = [
            { id: 'temp', name: 'Temperature (°C)', type: 'number', unit: '°C', defaultValue: 25 },
            { id: 'humidity', name: 'Humidity (%)', type: 'number', unit: '%', defaultValue: 60 },
            { id: 'aqi', name: 'Air quality (AQI)', type: 'number', unit: 'AQI', defaultValue: 80 },
            { id: 'pm25', name: 'PM2.5', type: 'number', unit: 'µg/m³', defaultValue: 35 }
        ];

        const readCardConfig = (card) => {
            try {
                const raw = card?.dataset?.routineConfig;
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : null;
            } catch (_) {
                return null;
            }
        };

        const setCardContent = (card, { icon, title, subtitle, tone, config }) => {
            const iconEl = card.querySelector('.builder-card-icon .material-icons');
            const titleEl = card.querySelector('.builder-card-info h4');
            const subEl = card.querySelector('.builder-card-info p');
            if (iconEl) iconEl.textContent = icon;
            if (titleEl) titleEl.textContent = title;
            if (subEl) subEl.textContent = subtitle || '';
            const iconWrap = card.querySelector('.builder-card-icon');
            if (iconWrap) {
                iconWrap.className = `builder-card-icon${tone ? ` builder-card-icon--${tone}` : ''}`;
            }
            if (config) {
                try {
                    card.dataset.routineConfig = JSON.stringify(config);
                } catch (_) { }
            } else {
                delete card.dataset.routineConfig;
            }
        };

        const createCard = ({ kind, icon, title, subtitle, tone, config }) => {
            const card = document.createElement('div');
            card.className = 'builder-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.dataset.routineItem = kind;
            const toneClass = kind === 'trigger' && tone ? ` builder-card-icon--${tone}` : '';
            card.innerHTML = `
                <div class="builder-card-left">
                    <div class="builder-card-icon${toneClass}">
                        <span class="material-icons">${icon}</span>
                    </div>
                    <div class="builder-card-info">
                        <h4>${title}</h4>
                        <p>${subtitle}</p>
                    </div>
                </div>
                <span class="material-icons builder-card-chevron">chevron_right</span>
            `;
            if (config) {
                try {
                    card.dataset.routineConfig = JSON.stringify(config);
                } catch (_) { }
            }
            return card;
        };

        const clearAndSet = (list, items, kind) => {
            list.innerHTML = '';
            items.forEach(it => list.appendChild(createCard({ kind, ...it })));
        };

        let sheetMode = null;
        let editingCard = null;

        const closeSheet = () => {
            if (!overlay || !sheet) return;
            overlay.classList.remove('active');
            sheet.classList.remove('active');
            sheet.setAttribute('aria-hidden', 'true');
            sheetMode = null;
            editingCard = null;
        };

        const loadRoutines = () => {
            try {
                const raw = sessionStorage.getItem(key);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        };

        const formatRepeat = (repeat) => {
            if (repeat === 'weekdays') return 'Weekdays';
            if (repeat === 'weekends') return 'Weekends';
            if (repeat === 'daily') return 'Daily';
            return 'Once';
        };

        const openSheet = (mode, card = null) => {
            if (!overlay || !sheet || !sheetOptions) return;
            sheetMode = mode;
            editingCard = card;

            const openList = () => {
                const options = mode === 'trigger' ? TRIGGERS : ACTIONS;
                if (sheetTitle) sheetTitle.textContent = mode === 'trigger' ? (editingCard ? 'Edit condition' : 'Add condition') : (editingCard ? 'Edit task' : 'Add task');
                if (sheetSubtitle) sheetSubtitle.textContent = mode === 'trigger' ? 'Scene condition' : 'Scene task';
                if (sheetIcon) sheetIcon.textContent = mode === 'trigger' ? 'tune' : 'bolt';

                sheetOptions.innerHTML = '';
                options.forEach(opt => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'control-card routine-option';
                    b.setAttribute('data-option-key', opt.key);
                    b.innerHTML = `
                        <div class="control-head">
                            <div class="control-title">${opt.title}</div>
                            <div class="control-value"><span class="material-icons">${opt.icon}</span></div>
                        </div>
                        <p class="routine-option-sub">${opt.subtitle}</p>
                    `;
                    b.addEventListener('click', () => openConfig(opt.key));
                    sheetOptions.appendChild(b);
                });
            };

            const buildField = ({ label, input }) => {
                const wrap = document.createElement('div');
                wrap.className = 'sheet-field';
                const l = document.createElement('div');
                l.className = 'sheet-label';
                l.textContent = label;
                wrap.appendChild(l);
                wrap.appendChild(input);
                return wrap;
            };

            const makeSelect = (items, value) => {
                const sel = document.createElement('select');
                sel.className = 'sheet-select';
                items.forEach(it => {
                    const opt = document.createElement('option');
                    opt.value = it.value;
                    opt.textContent = it.label;
                    sel.appendChild(opt);
                });
                if (value != null) sel.value = value;
                return sel;
            };

            const makeInput = (type, value, placeholder) => {
                const inp = document.createElement('input');
                inp.type = type;
                inp.className = 'sheet-input';
                if (placeholder) inp.placeholder = placeholder;
                if (value != null) inp.value = value;
                return inp;
            };

            const openConfig = (optKey) => {
                const existing = editingCard ? (readCardConfig(editingCard) || {}) : {};
                if (sheetTitle) sheetTitle.textContent = mode === 'trigger' ? 'Configure condition' : 'Configure task';
                if (sheetSubtitle) sheetSubtitle.textContent = '';
                const def = (mode === 'trigger' ? TRIGGERS : ACTIONS).find(x => x.key === optKey);
                if (sheetIcon) sheetIcon.textContent = def?.icon || (mode === 'trigger' ? 'tune' : 'bolt');

                sheetOptions.innerHTML = '';
                const form = document.createElement('div');
                form.className = 'sheet-form';

                const actionsRow = document.createElement('div');
                actionsRow.className = 'sheet-actions';
                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'sheet-secondary-btn';
                backBtn.textContent = 'Back';
                backBtn.addEventListener('click', openList);
                const saveBtn = document.createElement('button');
                saveBtn.type = 'button';
                saveBtn.className = 'sheet-primary-btn';
                saveBtn.textContent = 'Save';

                const commit = (data) => {
                    const payload = { ...data.config };
                    const tone = data.tone || null;
                    if (editingCard) {
                        setCardContent(editingCard, { ...data, tone, config: payload });
                    } else if (mode === 'trigger') {
                        triggersList.appendChild(createCard({ kind: 'trigger', ...data, tone, config: payload }));
                    } else {
                        actionsList.appendChild(createCard({ kind: 'action', ...data, tone, config: payload }));
                    }
                    closeSheet();
                };

                const buildSchedule = () => {
                    const time = makeInput('time', existing.time || '08:00');
                    const repeat = makeSelect([
                        { value: 'weekdays', label: 'Weekdays' },
                        { value: 'weekends', label: 'Weekends' },
                        { value: 'daily', label: 'Daily' },
                        { value: 'once', label: 'Once' }
                    ], existing.repeat || 'weekdays');
                    form.appendChild(buildField({ label: 'Time', input: time }));
                    form.appendChild(buildField({ label: 'Repeat', input: repeat }));
                    saveBtn.addEventListener('click', () => {
                        const t = time.value || '08:00';
                        const r = repeat.value || 'weekdays';
                        commit({
                            icon: 'schedule',
                            title: 'Schedule',
                            subtitle: `${t} • ${formatRepeat(r)}`,
                            tone: 'time',
                            config: { type: 'schedule', time: t, repeat: r }
                        });
                    }, { once: true });
                };

                const buildSun = () => {
                    const city = makeSelect(CITIES.map(c => ({ value: c, label: c })), existing.city || CITIES[0]);
                    const moment = makeSelect([{ value: 'sunrise', label: 'Sunrise' }, { value: 'sunset', label: 'Sunset' }], existing.moment || 'sunset');
                    const offset = makeInput('number', existing.offset ?? 0, 'Minutes');
                    offset.min = '-120';
                    offset.max = '120';
                    form.appendChild(buildField({ label: 'City', input: city }));
                    form.appendChild(buildField({ label: 'Moment', input: moment }));
                    form.appendChild(buildField({ label: 'Offset (min)', input: offset }));
                    saveBtn.addEventListener('click', () => {
                        const c = city.value || CITIES[0];
                        const m = moment.value || 'sunset';
                        const o = Number(offset.value || 0);
                        const off = o === 0 ? '0 min' : `${o > 0 ? '+' : ''}${o} min`;
                        commit({
                            icon: 'sunny',
                            title: 'Sunrise / Sunset',
                            subtitle: `${m === 'sunrise' ? 'Sunrise' : 'Sunset'} • ${off} • ${c}`,
                            tone: 'sun',
                            config: { type: 'sun', city: c, moment: m, offset: o }
                        });
                    }, { once: true });
                };

                const buildWeather = () => {
                    const field = makeSelect(WEATHER_FIELDS.map(f => ({ value: f.id, label: f.name })), existing.field || 'temp');
                    const op = makeSelect([{ value: '>', label: '>' }, { value: '<', label: '<' }, { value: '=', label: '=' }], existing.op || '>');
                    const val = makeInput('number', existing.value ?? 25);
                    const city = makeSelect(CITIES.map(c => ({ value: c, label: c })), existing.city || CITIES[0]);
                    form.appendChild(buildField({ label: 'City', input: city }));
                    form.appendChild(buildField({ label: 'Weather field', input: field }));
                    form.appendChild(buildField({ label: 'Operator', input: op }));
                    form.appendChild(buildField({ label: 'Value', input: val }));
                    saveBtn.addEventListener('click', () => {
                        const c = city.value || CITIES[0];
                        const f = field.value || 'temp';
                        const fDef = WEATHER_FIELDS.find(x => x.id === f) || WEATHER_FIELDS[0];
                        const oper = op.value || '>';
                        const v = Number(val.value || fDef.defaultValue || 0);
                        commit({
                            icon: 'cloud',
                            title: 'Weather',
                            subtitle: `${fDef.name.split('(')[0].trim()} ${oper} ${v}${fDef.unit ? ` ${fDef.unit}` : ''} • ${c}`,
                            tone: 'sun',
                            config: { type: 'weather', city: c, field: f, op: oper, value: v }
                        });
                    }, { once: true });
                };

                const buildLocation = () => {
                    const modeSel = makeSelect([{ value: 'arrive', label: 'Arrive' }, { value: 'leave', label: 'Leave' }], existing.mode || 'leave');
                    const place = makeSelect([{ value: 'Home', label: 'Home' }, { value: 'Work', label: 'Work' }], existing.place || 'Home');
                    const radius = makeInput('number', existing.radius ?? 200);
                    radius.min = '50';
                    radius.max = '2000';
                    form.appendChild(buildField({ label: 'Event', input: modeSel }));
                    form.appendChild(buildField({ label: 'Place', input: place }));
                    form.appendChild(buildField({ label: 'Radius (m)', input: radius }));
                    saveBtn.addEventListener('click', () => {
                        const m = modeSel.value || 'leave';
                        const p = place.value || 'Home';
                        const r = Number(radius.value || 200);
                        commit({
                            icon: 'location_on',
                            title: 'Location',
                            subtitle: `${m === 'arrive' ? 'Arrive' : 'Leave'} • ${p} • ${r}m`,
                            tone: 'location',
                            config: { type: 'location', mode: m, place: p, radius: r }
                        });
                    }, { once: true });
                };

                const buildDeviceCondition = () => {
                    const deviceSel = makeSelect(DEVICES.map(d => ({ value: d.id, label: d.name })), existing.deviceId || DEVICES[0].id);
                    const dpSel = makeSelect([], existing.dpId);
                    const valueSel = makeSelect([], existing.value);

                    const syncDps = () => {
                        const device = DEVICES.find(d => d.id === deviceSel.value) || DEVICES[0];
                        dpSel.innerHTML = '';
                        device.dps.forEach(dp => {
                            const o = document.createElement('option');
                            o.value = dp.id;
                            o.textContent = dp.name;
                            dpSel.appendChild(o);
                        });
                        dpSel.value = existing.dpId && device.dps.some(dp => dp.id === existing.dpId) ? existing.dpId : device.dps[0]?.id;
                        syncValues();
                    };

                    const syncValues = () => {
                        const device = DEVICES.find(d => d.id === deviceSel.value) || DEVICES[0];
                        const dp = device.dps.find(x => x.id === dpSel.value) || device.dps[0];
                        valueSel.innerHTML = '';
                        if (dp?.type === 'bool') {
                            [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }].forEach(it => {
                                const o = document.createElement('option');
                                o.value = it.value;
                                o.textContent = it.label;
                                valueSel.appendChild(o);
                            });
                        } else if (dp?.type === 'range') {
                            [{ value: '10', label: '10%' }, { value: '30', label: '30%' }, { value: '60', label: '60%' }, { value: '100', label: '100%' }].forEach(it => {
                                const o = document.createElement('option');
                                o.value = it.value;
                                o.textContent = it.label;
                                valueSel.appendChild(o);
                            });
                        } else if (dp?.type === 'enum') {
                            (dp.options || []).forEach(v => {
                                const o = document.createElement('option');
                                o.value = v;
                                o.textContent = v;
                                valueSel.appendChild(o);
                            });
                        }
                        if (existing.value != null) valueSel.value = `${existing.value}`;
                    };

                    deviceSel.addEventListener('change', syncDps);
                    dpSel.addEventListener('change', syncValues);
                    form.appendChild(buildField({ label: 'Device', input: deviceSel }));
                    form.appendChild(buildField({ label: 'Property', input: dpSel }));
                    form.appendChild(buildField({ label: 'When value is', input: valueSel }));
                    syncDps();

                    saveBtn.addEventListener('click', () => {
                        const device = DEVICES.find(d => d.id === deviceSel.value) || DEVICES[0];
                        const dp = device.dps.find(x => x.id === dpSel.value) || device.dps[0];
                        const v = valueSel.value;
                        const subtitle = `${device.name} • ${dp?.name || 'State'} = ${v}`;
                        commit({
                            icon: 'sensors',
                            title: 'Device status',
                            subtitle,
                            tone: 'device',
                            config: { type: 'device', deviceId: device.id, deviceName: device.name, dpId: dp?.id, dpName: dp?.name, value: v }
                        });
                    }, { once: true });
                };

                const buildDeviceAction = () => {
                    const deviceSel = makeSelect(DEVICES.filter(d => d.kind !== 'sensor').map(d => ({ value: d.id, label: d.name })), existing.deviceId || DEVICES[0].id);
                    const dpSel = makeSelect([], existing.dpId);
                    const valueSel = makeSelect([], existing.value);

                    const syncDps = () => {
                        const device = DEVICES.find(d => d.id === deviceSel.value) || DEVICES[0];
                        dpSel.innerHTML = '';
                        device.dps.forEach(dp => {
                            const o = document.createElement('option');
                            o.value = dp.id;
                            o.textContent = dp.name;
                            dpSel.appendChild(o);
                        });
                        dpSel.value = existing.dpId && device.dps.some(dp => dp.id === existing.dpId) ? existing.dpId : device.dps[0]?.id;
                        syncValues();
                    };

                    const syncValues = () => {
                        const device = DEVICES.find(d => d.id === deviceSel.value) || DEVICES[0];
                        const dp = device.dps.find(x => x.id === dpSel.value) || device.dps[0];
                        valueSel.innerHTML = '';
                        if (dp?.type === 'bool') {
                            [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }].forEach(it => {
                                const o = document.createElement('option');
                                o.value = it.value;
                                o.textContent = it.label;
                                valueSel.appendChild(o);
                            });
                        } else if (dp?.type === 'range') {
                            [{ value: '10', label: '10%' }, { value: '30', label: '30%' }, { value: '60', label: '60%' }, { value: '100', label: '100%' }].forEach(it => {
                                const o = document.createElement('option');
                                o.value = it.value;
                                o.textContent = it.label;
                                valueSel.appendChild(o);
                            });
                        } else if (dp?.type === 'enum') {
                            (dp.options || []).forEach(v => {
                                const o = document.createElement('option');
                                o.value = v;
                                o.textContent = v;
                                valueSel.appendChild(o);
                            });
                        }
                        if (existing.value != null) valueSel.value = `${existing.value}`;
                    };

                    deviceSel.addEventListener('change', syncDps);
                    dpSel.addEventListener('change', syncValues);
                    form.appendChild(buildField({ label: 'Device', input: deviceSel }));
                    form.appendChild(buildField({ label: 'Property', input: dpSel }));
                    form.appendChild(buildField({ label: 'Set value to', input: valueSel }));
                    syncDps();

                    saveBtn.addEventListener('click', () => {
                        const device = DEVICES.find(d => d.id === deviceSel.value) || DEVICES[0];
                        const dp = device.dps.find(x => x.id === dpSel.value) || device.dps[0];
                        const v = valueSel.value;
                        const subtitle = `${device.name} • ${dp?.name || 'State'} → ${v}`;
                        commit({
                            icon: device.icon || 'toggle_on',
                            title: 'Control device',
                            subtitle,
                            config: { type: 'device', deviceId: device.id, deviceName: device.name, dpId: dp?.id, dpName: dp?.name, value: v }
                        });
                    }, { once: true });
                };

                const buildNotification = () => {
                    const msg = makeInput('text', existing.message || 'Routine ran', 'Message');
                    form.appendChild(buildField({ label: 'Message', input: msg }));
                    saveBtn.addEventListener('click', () => {
                        const m = (msg.value || '').trim() || 'Routine ran';
                        commit({
                            icon: 'notifications',
                            title: 'Send notification',
                            subtitle: m,
                            config: { type: 'notification', message: m }
                        });
                    }, { once: true });
                };

                const buildRoutineRef = (refType) => {
                    const items = loadRoutines();
                    const sel = makeSelect(items.map(r => ({ value: r.id, label: r.name })), existing.targetId);
                    form.appendChild(buildField({ label: 'Target routine', input: sel }));
                    saveBtn.addEventListener('click', () => {
                        const id = sel.value;
                        const r = items.find(x => x.id === id);
                        const label = r?.name || 'Routine';
                        const iconMap = { scene_trigger: 'play_circle', scene_enable: 'check_circle', scene_disable: 'block' };
                        const titleMap = { scene_trigger: 'Trigger routine', scene_enable: 'Enable routine', scene_disable: 'Disable routine' };
                        const subMap = { scene_trigger: `Run • ${label}`, scene_enable: `Enable • ${label}`, scene_disable: `Disable • ${label}` };
                        commit({
                            icon: iconMap[refType] || 'play_circle',
                            title: titleMap[refType] || 'Trigger routine',
                            subtitle: subMap[refType] || label,
                            config: { type: refType, targetId: id, targetName: label }
                        });
                    }, { once: true });
                };

                if (mode === 'trigger') {
                    if (optKey === 'manual') {
                        saveBtn.addEventListener('click', () => {
                            commit({
                                icon: 'play_arrow',
                                title: 'Manually run',
                                subtitle: 'Tap to run',
                                tone: 'time',
                                config: { type: 'manual' }
                            });
                        }, { once: true });
                    } else if (optKey === 'schedule') {
                        buildSchedule();
                    } else if (optKey === 'sun') {
                        buildSun();
                    } else if (optKey === 'weather') {
                        buildWeather();
                    } else if (optKey === 'location') {
                        buildLocation();
                    } else if (optKey === 'device') {
                        buildDeviceCondition();
                    } else {
                        openList();
                        return;
                    }
                } else {
                    if (optKey === 'device') {
                        buildDeviceAction();
                    } else if (optKey === 'notification') {
                        buildNotification();
                    } else if (optKey === 'scene_trigger' || optKey === 'scene_enable' || optKey === 'scene_disable') {
                        buildRoutineRef(optKey);
                    } else {
                        openList();
                        return;
                    }
                }

                actionsRow.appendChild(backBtn);
                actionsRow.appendChild(saveBtn);
                form.appendChild(actionsRow);
                sheetOptions.appendChild(form);
            };

            const existingCfg = editingCard ? readCardConfig(editingCard) : null;
            const mapTypeToKey = (t) => {
                if (!t) return null;
                if (t === 'manual') return 'manual';
                if (t === 'schedule') return 'schedule';
                if (t === 'sun') return 'sun';
                if (t === 'weather') return 'weather';
                if (t === 'location') return 'location';
                if (t === 'device') return 'device';
                if (t === 'notification') return 'notification';
                if (t === 'scene_trigger') return 'scene_trigger';
                if (t === 'scene_enable') return 'scene_enable';
                if (t === 'scene_disable') return 'scene_disable';
                return null;
            };
            const keyToOpen = mapTypeToKey(existingCfg?.type);
            if (keyToOpen) openConfig(keyToOpen);
            else openList();

            overlay.classList.add('active');
            sheet.classList.add('active');
            sheet.setAttribute('aria-hidden', 'false');
            sheetClose?.focus?.({ preventScroll: true });
        };

        const collectSummary = () => {
            const triggerTitle = triggersList.querySelector('.builder-card-info h4')?.textContent?.trim() || '';
            const triggerSub = triggersList.querySelector('.builder-card-info p')?.textContent?.trim() || '';
            const actionCount = actionsList.querySelectorAll('.builder-card').length;
            const actionIcon = actionsList.querySelector('.builder-card-icon .material-icons')?.textContent?.trim() || 'auto_awesome';
            const metaBits = [triggerTitle || 'Trigger', triggerSub].filter(Boolean).join(' • ');
            return {
                icon: actionIcon,
                meta: metaBits || `${actionCount} actions`,
                actionCount
            };
        };

        const exportCards = (list, kind) => {
            return Array.from(list.querySelectorAll('.builder-card[data-routine-item]')).map(card => {
                const title = card.querySelector('.builder-card-info h4')?.textContent?.trim() || '';
                const subtitle = card.querySelector('.builder-card-info p')?.textContent?.trim() || '';
                const icon = card.querySelector('.builder-card-icon .material-icons')?.textContent?.trim() || '';
                const config = readCardConfig(card) || null;
                const base = { kind, title, subtitle, icon };
                if (!config) return base;

                const entityTypeMap = { manual: 99, device: 1, schedule: 6, sun: 6, location: 10, weather: 3 };
                const entityType = kind === 'trigger' ? (entityTypeMap[config.type] ?? null) : null;
                return { ...base, config, entityType };
            });
        };

        const persistRoutine = () => {
            const name = (nameInput.value || '').trim();
            if (!name) {
                nameInput.focus({ preventScroll: true });
                return;
            }

            const summary = collectSummary();
            const conditions = exportCards(triggersList, 'trigger');
            const tasks = exportCards(actionsList, 'action');
            const routine = {
                id: uid(),
                name,
                enabled: true,
                icon: summary.icon,
                meta: summary.meta,
                conditions,
                tasks,
                createdAt: Date.now()
            };

            const items = (() => {
                try {
                    const raw = sessionStorage.getItem(key);
                    if (!raw) return [];
                    const parsed = JSON.parse(raw);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (_) {
                    return [];
                }
            })();

            items.unshift(routine);
            try {
                sessionStorage.setItem(key, JSON.stringify(items));
            } catch (_) { }

            location.href = 'scenes.html';
        };

        const applyTemplate = () => {
            try {
                const params = new URLSearchParams(location.search);
                const t = normalize(params.get('template'));
                if (!t || !templates[t]) return;
                const tpl = templates[t];
                nameInput.value = tpl.name;
                clearAndSet(triggersList, [tpl.trigger], 'trigger');
                clearAndSet(actionsList, tpl.actions, 'action');
            } catch (_) { }
        };

        addTrigger?.addEventListener('click', () => openSheet('trigger'));
        addAction?.addEventListener('click', () => openSheet('action'));
        saveBottom?.addEventListener('click', persistRoutine);

        stage.addEventListener('click', (e) => {
            const card = e.target.closest?.('.builder-card[data-routine-item]');
            if (!card) return;
            const kind = card.dataset.routineItem;
            if (kind !== 'trigger' && kind !== 'action') return;
            openSheet(kind, card);
        });

        stage.addEventListener('keydown', (e) => {
            const card = e.target.closest?.('.builder-card[data-routine-item]');
            if (!card) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            const kind = card.dataset.routineItem;
            if (kind !== 'trigger' && kind !== 'action') return;
            openSheet(kind, card);
        });

        overlay?.addEventListener('click', closeSheet);
        sheetClose?.addEventListener('click', closeSheet);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSheet();
        });

        applyTemplate();
        const resetScroll = () => {
            try {
                stage.scrollTop = 0;
                stage.scrollTo?.({ top: 0, behavior: 'auto' });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                window.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
            } catch (_) { }
        };
        resetScroll();
        requestAnimationFrame(resetScroll);
        setTimeout(resetScroll, 0);
        setTimeout(resetScroll, 80);
        setTimeout(resetScroll, 260);
        window.addEventListener('pageshow', () => {
            resetScroll();
            setTimeout(resetScroll, 0);
            setTimeout(resetScroll, 120);
        });
        window.addEventListener('load', () => {
            resetScroll();
            setTimeout(resetScroll, 120);
        }, { once: true });
        return { persistRoutine };
    };

    initStatusBar();
    initTimeSlider();
    initMeshBackground();
    initHomeIndicator();
    initNavTransitions();
    initAssistantOverlay();
    initHomePicker();
    initHomeLayout();
    initHomeOverflowMenu();
    initHomeAutomations();
    initDevicesOverview();
    initAddHomePage();
    const devicesPage = initDevicesPage();
    initDeviceDetailPage();
    initAddDevicePage();
    initRoutinesPage();
    initRoutineBuilder();

    document.querySelectorAll('.md3-switch').forEach(sw => {
        sw.addEventListener('click', e => {
            e.stopPropagation();
            sw.classList.toggle('on');
            const tile = sw.closest('.device-card, .quick-tile, .home-device-tile, .unit-tile, .routine-item');
            if (tile) tile.classList.toggle('active', sw.classList.contains('on'));
            devicesPage?.updateCounts?.();
        });
    });

    document.querySelectorAll('[data-toggle-tile]').forEach(tile => {
        tile.addEventListener('click', () => {
            const sw = tile.querySelector('.md3-switch');
            if (sw) {
                sw.classList.toggle('on');
                tile.classList.toggle('active', sw.classList.contains('on'));
                devicesPage?.updateCounts?.();
                return;
            }
            tile.classList.toggle('active');
            devicesPage?.updateCounts?.();
        });
    });
})();
