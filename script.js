const STORAGE_KEY = 'knowMeData';
const APP_VERSION = '1.0.4';
const WHEEL_ITEM = 44;
const RELATIVE_ROLES = [
    { id: 'parent', label: 'Parent' },
    { id: 'partner', label: 'Partner' },
    { id: 'sibling', label: 'Sibling' },
    { id: 'child', label: 'Child' },
    { id: 'other', label: 'Other' }
];

const CATEGORIES = [
    { id: 'dates', label: 'Dates', icon: '📅', hint: 'Birthdays, anniversaries, and days that matter' },
    { id: 'family', label: 'Family', icon: '👨‍👩‍👧', hint: 'People around them' },
    { id: 'food', label: 'Food', icon: '🍽️', hint: 'Favorites, restaurants, allergies' },
    { id: 'movies', label: 'Movies & TV', icon: '🎬', hint: 'Shows and films they love' },
    { id: 'music', label: 'Music', icon: '🎵', hint: 'Artists, songs, and playlists' },
    { id: 'hobbies', label: 'Hobbies', icon: '🎨', hint: 'How they like to spend time' },
    { id: 'vacations', label: 'Vacations', icon: '✈️', hint: 'Trips they loved and places to go' },
    { id: 'gifts', label: 'Gifts', icon: '🎁', hint: 'Sizes, wishlist, and ideas' },
    { id: 'dislikes', label: 'Dislikes', icon: '🚫', hint: 'Things to avoid' },
    { id: 'notes', label: 'Notes', icon: '📝', hint: 'Anything else worth remembering' }
];

class KnowMe {
    constructor() {
        this.data = { people: [] };
        this.currentTab = 'home';
        this.currentPersonId = null;
        this.currentCategory = null;
        this.editingPersonId = null;
        this.editingNoteId = null;
        this.ask = { personId: '', category: '', question: null };
        this.dateParts = { year: new Date().getFullYear(), month: 1, day: 1 };
        this.wheelLock = false;
        this.wheelTimer = null;
        this.editingRelativeId = null;
        this.checkingForUpdate = false;
        this.load();
        this.bind();
        this.renderAll();
        this.registerServiceWorker();
    }

    load() {
        try {
            let raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                const previous = localStorage.getItem('keepCloseData');
                if (previous) {
                    raw = previous;
                    localStorage.setItem(STORAGE_KEY, previous);
                    localStorage.removeItem('keepCloseData');
                }
            }
            const parsed = raw ? JSON.parse(raw) : { people: [] };
            this.data = { people: Array.isArray(parsed.people) ? parsed.people : [] };
            this.data.people.forEach((person) => {
                if (!Array.isArray(person.notes)) person.notes = [];
                if (!Array.isArray(person.relatives)) person.relatives = [];
            });
        } catch (error) {
            console.error('Could not load saved notes', error);
            this.data = { people: [] };
        }
    }

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    uid(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    getPerson(id) {
        return this.data.people.find((person) => person.id === id) || null;
    }

    getCategory(id) {
        return CATEGORIES.find((category) => category.id === id) || null;
    }

    notesIn(person, categoryId) {
        return (person.notes || []).filter((note) => note.category === categoryId);
    }

    bind() {
        document.querySelectorAll('.nav-item').forEach((btn) => {
            btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
        });

        document.getElementById('homeAskBtn').addEventListener('click', () => this.showTab('ask'));
        document.getElementById('addPersonBtn').addEventListener('click', () => this.openPersonModal());
        document.getElementById('savePersonBtn').addEventListener('click', () => this.savePerson());
        document.getElementById('cancelPersonBtn').addEventListener('click', () => this.closePersonModal());
        document.getElementById('deletePersonBtn').addEventListener('click', () => this.deletePerson());
        document.getElementById('closePersonBtn').addEventListener('click', () => this.closePersonScreen());
        document.getElementById('editPersonBtn').addEventListener('click', () => {
            this.openPersonModal(this.currentPersonId);
        });
        document.getElementById('hubAskBtn').addEventListener('click', () => {
            this.showTab('ask', this.currentPersonId);
        });
        document.getElementById('hubPhotoBtn').addEventListener('click', () => {
            document.getElementById('photoInput').click();
        });
        document.getElementById('photoInput').addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (file) this.setPhoto(file);
        });

        document.getElementById('closeCategoryBtn').addEventListener('click', () => this.closeCategoryScreen());
        document.getElementById('addNoteBtn').addEventListener('click', () => this.openNoteModal());
        document.getElementById('saveNoteBtn').addEventListener('click', () => this.saveNote());
        document.getElementById('cancelNoteBtn').addEventListener('click', () => this.closeNoteModal());
        document.getElementById('deleteNoteBtn').addEventListener('click', () => this.deleteNote());

        document.getElementById('askPersonSelect').addEventListener('change', (event) => {
            this.ask.personId = event.target.value;
            this.pickQuestion();
        });
        document.getElementById('askCategorySelect').addEventListener('change', (event) => {
            this.ask.category = event.target.value;
            this.pickQuestion();
        });
        document.getElementById('saveAnswerBtn').addEventListener('click', () => this.saveAnswer());
        document.getElementById('skipQuestionBtn').addEventListener('click', () => this.pickQuestion(true));

        document.getElementById('exportBtn').addEventListener('click', () => this.exportBackup());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (file) this.importBackup(file);
        });

        document.getElementById('peopleList').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-person-id]');
            if (btn) this.openPersonScreen(btn.dataset.personId);
        });
        document.getElementById('homePeople').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-person-id]');
            if (btn) this.openPersonScreen(btn.dataset.personId);
        });
        document.getElementById('upcomingList').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-person-id]');
            if (!btn) return;
            this.openPersonScreen(btn.dataset.personId);
            if (btn.dataset.category) this.openCategoryScreen(btn.dataset.category);
        });
        document.getElementById('categoryGrid').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-category]');
            if (btn) this.openCategoryScreen(btn.dataset.category);
        });
        document.getElementById('categoryNotes').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-note-id]');
            if (btn) this.openNoteModal(btn.dataset.noteId);
        });
        document.getElementById('dateLabelChips').addEventListener('click', (event) => {
            const chip = event.target.closest('[data-label]');
            if (!chip) return;
            document.getElementById('noteLabelInput').value = chip.dataset.label;
        });
        ['monthWheel', 'dayWheel', 'yearWheel'].forEach((id) => {
            const wheel = document.getElementById(id);
            wheel.addEventListener('scroll', () => this.onWheelScroll(id));
            wheel.addEventListener('click', (event) => {
                const item = event.target.closest('.wheel-item');
                if (!item) return;
                const items = [...wheel.querySelectorAll('.wheel-item')];
                wheel.scrollTo({ top: items.indexOf(item) * WHEEL_ITEM, behavior: 'smooth' });
            });
        });
        document.getElementById('addRelativeBtn').addEventListener('click', () => this.openRelativeModal());
        document.getElementById('saveRelativeBtn').addEventListener('click', () => this.saveRelative());
        document.getElementById('cancelRelativeBtn').addEventListener('click', () => this.closeRelativeModal());
        document.getElementById('deleteRelativeBtn').addEventListener('click', () => this.deleteRelative());
        document.getElementById('familyTree').addEventListener('click', (event) => {
            const card = event.target.closest('[data-relative-id]');
            if (card) this.openRelativeModal(card.dataset.relativeId);
        });
        document.getElementById('updateNowBtn').addEventListener('click', () => this.applyUpdate());
        document.getElementById('updateLaterBtn').addEventListener('click', () => this.hideUpdateBanner());
        document.getElementById('checkUpdateBtn').addEventListener('click', () => this.checkForUpdate(true));
    }

    showTab(tab, personId) {
        this.closePersonScreen();
        this.closeCategoryScreen();
        this.currentTab = tab;
        document.querySelectorAll('.tab-content').forEach((el) => el.classList.remove('active'));
        document.getElementById(`${tab}Tab`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        if (tab === 'ask') {
            if (personId) this.ask.personId = personId;
            this.renderAsk();
        }
        if (tab === 'home') this.renderHome();
        if (tab === 'people') this.renderPeopleList();
    }

    renderAll() {
        this.renderHome();
        this.renderPeopleList();
        this.renderAsk();
    }

    renderHome() {
        const upcoming = this.getUpcomingDates();
        const list = document.getElementById('upcomingList');
        if (!upcoming.length) {
            list.innerHTML = '<p class="empty">Nothing</p>';
        } else {
            list.innerHTML = upcoming.map((item) => `
                <button type="button" class="date-row" data-person-id="${item.personId}" data-category="dates">
                    <div class="person-meta">
                        <strong>${this.escape(item.label)} · ${this.escape(item.personName)}</strong>
                        <span>${this.escape(item.when)}</span>
                    </div>
                </button>
            `).join('');
        }

        const homePeople = document.getElementById('homePeople');
        if (!this.data.people.length) {
            homePeople.innerHTML = '<p class="empty">Add someone from the People tab to get started.</p>';
        } else {
            homePeople.innerHTML = this.data.people.map((person) => this.personRowHtml(person)).join('');
        }
    }

    renderPeopleList() {
        const list = document.getElementById('peopleList');
        if (!this.data.people.length) {
            list.innerHTML = '<p class="empty">No one here yet. Add a loved one to start remembering the little things.</p>';
            return;
        }
        const sorted = [...this.data.people].sort((a, b) => a.name.localeCompare(b.name));
        list.innerHTML = sorted.map((person) => this.personRowHtml(person)).join('');
    }

    personRowHtml(person) {
        const initial = (person.name || '?').trim().charAt(0).toUpperCase();
        const photo = this.safePhoto(person.photo)
            ? `<img src="${this.safePhoto(person.photo)}" alt="">`
            : `<span>${this.escape(initial)}</span>`;
        const extra = person.relationship ? this.escape(person.relationship) : 'Tap to open';
        return `
            <button type="button" class="person-row" data-person-id="${person.id}">
                <span class="avatar">${photo}</span>
                <span class="person-meta">
                    <strong>${this.escape(person.name)}</strong>
                    <span>${extra}</span>
                </span>
            </button>
        `;
    }

    openPersonScreen(personId) {
        const person = this.getPerson(personId);
        if (!person) return;
        this.currentPersonId = personId;
        this.renderHub();
        document.getElementById('personScreen').classList.remove('hidden');
        document.body.classList.add('overlay-open');
    }

    closePersonScreen() {
        document.getElementById('personScreen').classList.add('hidden');
        this.currentPersonId = null;
        if (document.getElementById('categoryScreen').classList.contains('hidden')) {
            document.body.classList.remove('overlay-open');
        }
    }

    renderHub() {
        const person = this.getPerson(this.currentPersonId);
        if (!person) return;
        const img = document.getElementById('hubPhotoImg');
        const btn = document.getElementById('hubPhotoBtn');
        if (this.safePhoto(person.photo)) {
            img.src = this.safePhoto(person.photo);
            img.alt = person.name;
            btn.classList.add('has-photo');
        } else {
            img.removeAttribute('src');
            img.alt = '';
            btn.classList.remove('has-photo');
        }
        document.getElementById('hubName').textContent = person.name;
        document.getElementById('hubRelationship').textContent = person.relationship || 'Tap a topic to add what you know';
        document.getElementById('categoryGrid').innerHTML = CATEGORIES.map((category) => {
            const count = this.notesIn(person, category.id).length;
            const countLabel = count === 1 ? '1 saved' : `${count} saved`;
            return `
                <button type="button" class="category-tile" data-category="${category.id}">
                    <span class="tile-icon">${category.icon}</span>
                    <strong>${category.label}</strong>
                    <em>${count ? countLabel : 'Empty'}</em>
                </button>
            `;
        }).join('');
    }

    async setPhoto(file) {
        const person = this.getPerson(this.currentPersonId);
        if (!person) return;
        try {
            person.photo = await this.compressPhoto(file);
            this.save();
            this.renderHub();
            this.renderPeopleList();
            this.renderHome();
        } catch (error) {
            console.error(error);
            alert('Could not use that photo. Try another picture.');
        }
    }

    compressPhoto(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const max = 512;
                let width = img.width;
                let height = img.height;
                if (width > height && width > max) {
                    height = Math.round((height * max) / width);
                    width = max;
                } else if (height > max) {
                    width = Math.round((width * max) / height);
                    height = max;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.72));
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('image'));
            };
            img.src = url;
        });
    }

    openCategoryScreen(categoryId) {
        const person = this.getPerson(this.currentPersonId);
        const category = this.getCategory(categoryId);
        if (!person || !category) return;
        this.currentCategory = categoryId;
        document.getElementById('categoryTitle').textContent = category.label;
        document.getElementById('categoryHint').textContent = category.hint;
        document.getElementById('addNoteBtn').textContent = `Add to ${category.label}`;
        document.getElementById('familyTreeSection').classList.toggle('hidden', categoryId !== 'family');
        this.renderCategoryNotes();
        if (categoryId === 'family') this.renderFamilyTree();
        document.getElementById('categoryScreen').classList.remove('hidden');
        document.body.classList.add('overlay-open');
    }

    closeCategoryScreen() {
        document.getElementById('categoryScreen').classList.add('hidden');
        this.currentCategory = null;
        if (this.currentPersonId) this.renderHub();
        if (document.getElementById('personScreen').classList.contains('hidden')) {
            document.body.classList.remove('overlay-open');
        }
    }

    renderCategoryNotes() {
        const person = this.getPerson(this.currentPersonId);
        const list = document.getElementById('categoryNotes');
        if (!person) return;
        const notes = this.notesIn(person, this.currentCategory);
        const ownNotes = notes.filter((note) => !note.questionId);
        const answers = notes.filter((note) => note.questionId);
        if (!ownNotes.length && !answers.length) {
            list.innerHTML = '<p class="empty">Nothing saved here yet.</p>';
            return;
        }
        const sections = [];
        if (ownNotes.length) sections.push(this.noteSection('Your notes', ownNotes));
        if (answers.length) sections.push(this.noteSection('Questions', answers));
        list.innerHTML = sections.join('');
    }

    noteSection(title, notes) {
        const rows = notes.map((note) => {
            const heading = note.label || (note.dateValue ? this.formatDate(note.dateValue) : 'Note');
            const body = this.noteBody(note);
            return `
                <button type="button" class="note-row" data-note-id="${note.id}">
                    <strong>${this.escape(heading)}</strong>
                    ${body ? `<span>${this.escape(body)}</span>` : ''}
                </button>
            `;
        }).join('');
        return `<h3 class="note-section-label">${title}</h3>${rows}`;
    }

    noteBody(note) {
        if (note.category === 'dates') {
            const dateText = note.dateValue ? this.formatDate(note.dateValue) : '';
            if (note.label && dateText && note.value) return `${dateText} — ${note.value}`;
            if (note.label && dateText) return dateText;
            return note.value || '';
        }
        return note.value || '';
    }

    openPersonModal(personId) {
        this.editingPersonId = personId || null;
        const person = personId ? this.getPerson(personId) : null;
        document.getElementById('personModalTitle').textContent = person ? 'Edit' : 'Add someone';
        document.getElementById('personNameInput').value = person ? person.name : '';
        document.getElementById('personRelationshipInput').value = person ? (person.relationship || '') : '';
        document.getElementById('deletePersonBtn').classList.toggle('hidden', !person);
        document.getElementById('personModal').classList.remove('hidden');
        document.getElementById('personNameInput').focus();
    }

    closePersonModal() {
        document.getElementById('personModal').classList.add('hidden');
        this.editingPersonId = null;
    }

    savePerson() {
        const name = document.getElementById('personNameInput').value.trim();
        if (!name) {
            alert('Add a name first.');
            return;
        }
        const relationship = document.getElementById('personRelationshipInput').value.trim();
        if (this.editingPersonId) {
            const person = this.getPerson(this.editingPersonId);
            if (!person) return;
            person.name = name;
            person.relationship = relationship;
        } else {
            const person = {
                id: this.uid('p'),
                name,
                relationship,
                photo: '',
                notes: []
            };
            this.data.people.push(person);
            this.save();
            this.closePersonModal();
            this.renderPeopleList();
            this.renderHome();
            this.openPersonScreen(person.id);
            return;
        }
        this.save();
        this.closePersonModal();
        this.renderHub();
        this.renderPeopleList();
        this.renderHome();
    }

    deletePerson() {
        if (!this.editingPersonId) return;
        const person = this.getPerson(this.editingPersonId);
        if (!person) return;
        if (!confirm(`Remove ${person.name} from this phone?`)) return;
        this.data.people = this.data.people.filter((item) => item.id !== this.editingPersonId);
        this.save();
        this.closePersonModal();
        this.closeCategoryScreen();
        this.closePersonScreen();
        this.renderAll();
    }

    openNoteModal(noteId) {
        const person = this.getPerson(this.currentPersonId);
        if (!person || !this.currentCategory) return;
        const category = this.getCategory(this.currentCategory);
        const note = noteId ? person.notes.find((item) => item.id === noteId) : null;
        this.editingNoteId = note ? note.id : null;
        const isDates = this.currentCategory === 'dates';
        document.getElementById('noteModalTitle').textContent = note ? 'Edit' : `Add to ${category.label}`;
        document.getElementById('noteLabelInput').value = note ? (note.label || '') : '';
        document.getElementById('noteValueInput').value = note ? (note.value || '') : '';
        document.getElementById('noteDateInput').value = note && note.dateValue ? note.dateValue : '';
        document.getElementById('noteDateGroup').classList.toggle('hidden', !isDates);
        document.getElementById('noteValueLabel').textContent = isDates ? 'Details (optional)' : 'Details';
        document.getElementById('noteLabelInput').placeholder = '';
        document.getElementById('dateLabelChips').innerHTML = isDates
            ? ['Birthday', 'Anniversary'].map((label) => `<button type="button" class="chip" data-label="${label}">${label}</button>`).join('')
            : '';
        document.getElementById('deleteNoteBtn').classList.toggle('hidden', !note);
        document.getElementById('noteModal').classList.remove('hidden');
        if (isDates) this.setDateWheels(note && note.dateValue ? note.dateValue : this.toDateKey(new Date()));
    }

    closeNoteModal() {
        document.getElementById('noteModal').classList.add('hidden');
        this.editingNoteId = null;
    }

    saveNote() {
        const person = this.getPerson(this.currentPersonId);
        if (!person || !this.currentCategory) return;
        const label = document.getElementById('noteLabelInput').value.trim();
        const value = document.getElementById('noteValueInput').value.trim();
        const isDates = this.currentCategory === 'dates';
        if (isDates) {
            this.commitWheel('yearWheel');
            this.commitWheel('monthWheel');
            this.commitWheel('dayWheel');
        }
        const dateValue = document.getElementById('noteDateInput').value;
        if (!label) {
            alert('Add a label first.');
            return;
        }
        if (isDates && !dateValue) {
            alert('Add a date.');
            return;
        }
        if (this.editingNoteId) {
            const note = person.notes.find((item) => item.id === this.editingNoteId);
            if (!note) return;
            note.label = label;
            note.value = value;
            note.dateValue = isDates ? dateValue : '';
        } else {
            person.notes.push({
                id: this.uid('n'),
                category: this.currentCategory,
                label,
                value,
                dateValue: isDates ? dateValue : '',
                questionId: '',
                createdAt: new Date().toISOString()
            });
        }
        this.save();
        this.closeNoteModal();
        this.renderCategoryNotes();
        this.renderHub();
        this.renderHome();
    }

    deleteNote() {
        const person = this.getPerson(this.currentPersonId);
        if (!person || !this.editingNoteId) return;
        person.notes = person.notes.filter((note) => note.id !== this.editingNoteId);
        this.save();
        this.closeNoteModal();
        this.renderCategoryNotes();
        this.renderHub();
        this.renderHome();
    }

    renderAsk() {
        const personSelect = document.getElementById('askPersonSelect');
        const categorySelect = document.getElementById('askCategorySelect');
        if (!this.data.people.length) {
            personSelect.innerHTML = '<option value="">Add someone first</option>';
            categorySelect.innerHTML = '';
            document.getElementById('questionCard').innerHTML = '<p>Add a person, then come back to ask about them.</p>';
            document.getElementById('askAnswerWrap').classList.add('hidden');
            return;
        }
        if (!this.ask.personId || !this.getPerson(this.ask.personId)) {
            this.ask.personId = this.data.people[0].id;
        }
        personSelect.innerHTML = this.data.people
            .map((person) => `<option value="${person.id}" ${person.id === this.ask.personId ? 'selected' : ''}>${this.escape(person.name)}</option>`)
            .join('');
        categorySelect.innerHTML = `<option value="">Any topic</option>` + CATEGORIES
            .map((category) => `<option value="${category.id}" ${category.id === this.ask.category ? 'selected' : ''}>${category.label}</option>`)
            .join('');
        this.pickQuestion();
    }

    unansweredQuestions(person) {
        const answered = new Set((person.notes || []).map((note) => note.questionId).filter(Boolean));
        return (typeof QUESTIONS === 'undefined' ? [] : QUESTIONS).filter((question) => {
            if (answered.has(question.id)) return false;
            if (this.ask.category && question.category !== this.ask.category) return false;
            return true;
        });
    }

    pickQuestion(forceNew) {
        const person = this.getPerson(this.ask.personId);
        const card = document.getElementById('questionCard');
        const wrap = document.getElementById('askAnswerWrap');
        if (!person) {
            card.innerHTML = '<p>Add a person, then come back to ask about them.</p>';
            wrap.classList.add('hidden');
            return;
        }
        const pool = this.unansweredQuestions(person);
        if (!pool.length) {
            this.ask.question = null;
            card.innerHTML = '<p>You have answers for every question in this topic. Try another topic, or add notes on their profile.</p>';
            wrap.classList.add('hidden');
            return;
        }
        let next = pool[Math.floor(Math.random() * pool.length)];
        if (forceNew && this.ask.question && pool.length > 1) {
            const others = pool.filter((question) => question.id !== this.ask.question.id);
            next = others[Math.floor(Math.random() * others.length)];
        }
        this.ask.question = next;
        const topic = this.getCategory(next.category);
        card.innerHTML = `<p>${this.escape(next.prompt)}</p><span class="person-meta"><span>${topic ? topic.label : ''}</span></span>`;
        document.getElementById('askAnswerInput').value = '';
        wrap.classList.remove('hidden');
    }

    saveAnswer() {
        const person = this.getPerson(this.ask.personId);
        const question = this.ask.question;
        const value = document.getElementById('askAnswerInput').value.trim();
        if (!person || !question) return;
        if (!value) {
            alert('Write what you learned first.');
            return;
        }
        person.notes.push({
            id: this.uid('n'),
            category: question.category,
            label: question.prompt,
            value,
            dateValue: '',
            questionId: question.id,
            createdAt: new Date().toISOString()
        });
        this.save();
        document.getElementById('askAnswerInput').value = '';
        this.pickQuestion(true);
        this.renderHome();
        this.renderPeopleList();
    }

    getUpcomingDates() {
        const today = this.startOfDay(new Date());
        const horizon = new Date(today);
        horizon.setMonth(horizon.getMonth() + 3);
        const items = [];
        this.data.people.forEach((person) => {
            this.notesIn(person, 'dates').forEach((note) => {
                if (!note.dateValue) return;
                const next = this.nextOccurrence(note.dateValue);
                if (!next || next > horizon) return;
                const days = Math.round((next - today) / 86400000);
                items.push({
                    personId: person.id,
                    personName: person.name,
                    label: note.label || 'Date',
                    when: this.upcomingLabel(days, next),
                    days
                });
            });
        });
        return items.sort((a, b) => a.days - b.days);
    }

    nextOccurrence(dateValue) {
        const parts = String(dateValue).split('-').map(Number);
        if (parts.length < 3 || parts.some((part) => !part && part !== 0)) return null;
        const [, month, day] = parts;
        const today = this.startOfDay(new Date());
        let next = new Date(today.getFullYear(), month - 1, day);
        if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
        return this.startOfDay(next);
    }

    upcomingLabel(days, date) {
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        if (days < 14) return `In ${days} days`;
        return this.formatDate(this.toDateKey(date));
    }

    startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    toDateKey(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    formatDate(dateValue) {
        const parts = String(dateValue).split('-');
        if (parts.length < 3) return dateValue;
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    exportBackup() {
        const payload = {
            app: 'KnowMe',
            version: APP_VERSION,
            exportedAt: new Date().toISOString(),
            people: this.data.people
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'knowme-backup.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    importBackup(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const people = Array.isArray(parsed.people) ? parsed.people : (Array.isArray(parsed) ? parsed : null);
                if (!people) throw new Error('format');
                if (!confirm('Replace the notes on this phone with this backup?')) return;
                this.data.people = people.map((person) => ({
                    id: person.id || this.uid('p'),
                    name: person.name || 'Unnamed',
                    relationship: person.relationship || '',
                    photo: this.safePhoto(person.photo),
                    notes: Array.isArray(person.notes) ? person.notes : [],
                    relatives: Array.isArray(person.relatives) ? person.relatives : []
                }));
                this.save();
                this.closeCategoryScreen();
                this.closePersonScreen();
                this.renderAll();
                this.showTab('people');
            } catch (error) {
                console.error(error);
                alert('That file does not look like a KnowMe backup.');
            }
        };
        reader.readAsText(file);
    }

    safePhoto(value) {
        return typeof value === 'string' && value.startsWith('data:image/') ? value : '';
    }

    escape(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    registerServiceWorker() {
        if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
        navigator.serviceWorker.register('./service-worker.js').then((registration) => {
            this.swRegistration = registration;
            this.checkForUpdate(false);
            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateBanner();
                    }
                });
            });
        }).catch((error) => {
            console.error('Service worker failed', error);
        });
        if (navigator.serviceWorker.controller) {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
                if (event.data && event.data.version) {
                    document.getElementById('versionText').textContent = `Version ${event.data.version}`;
                }
            };
            navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        }
        setInterval(() => this.checkForUpdate(false), 5 * 60 * 1000);
    }

    async checkForUpdate(manual) {
        if (this.checkingForUpdate || !('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
        this.checkingForUpdate = true;
        const status = document.getElementById('updateStatusText');
        const button = document.getElementById('checkUpdateBtn');
        if (manual && button) button.disabled = true;
        if (manual && status) status.textContent = 'Checking...';
        try {
            if (this.swRegistration) await this.swRegistration.update();
            const response = await fetch('./service-worker.js?t=' + Date.now(), { cache: 'no-store' });
            const text = await response.text();
            const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
            const remote = match ? match[1] : APP_VERSION;
            if (this.compareVersions(remote, APP_VERSION) > 0 || (this.swRegistration && this.swRegistration.waiting)) {
                this.showUpdateBanner();
                if (status) status.textContent = 'An update is ready.';
            } else if (manual && status) {
                status.textContent = 'You have the latest version.';
            }
        } catch (error) {
            console.error(error);
            if (manual && status) status.textContent = 'Could not check for updates.';
        } finally {
            this.checkingForUpdate = false;
            if (button) button.disabled = false;
        }
    }

    compareVersions(left, right) {
        const a = String(left).split('.').map((part) => Number(part) || 0);
        const b = String(right).split('.').map((part) => Number(part) || 0);
        for (let i = 0; i < 3; i += 1) {
            if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
        }
        return 0;
    }

    showUpdateBanner() {
        document.getElementById('updateBanner').classList.remove('hidden');
    }

    hideUpdateBanner() {
        document.getElementById('updateBanner').classList.add('hidden');
    }

    async applyUpdate() {
        try {
            const names = await caches.keys();
            await Promise.all(names.map((name) => caches.delete(name)));
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        } catch (error) {
            console.error(error);
        }
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now());
        window.location.replace(url.toString());
    }

    daysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }

    numberRange(from, to) {
        const values = [];
        const step = from <= to ? 1 : -1;
        for (let value = from; step > 0 ? value <= to : value >= to; value += step) values.push(value);
        return values;
    }

    setDateWheels(iso) {
        const parts = String(iso || '').split('-').map(Number);
        const today = new Date();
        const year = parts[0] || today.getFullYear();
        const month = parts[1] || (today.getMonth() + 1);
        const day = parts[2] || today.getDate();
        this.dateParts = {
            year,
            month,
            day: Math.min(day, this.daysInMonth(year, month))
        };
        this.renderWheel('monthWheel', this.numberRange(1, 12), this.dateParts.month);
        this.renderWheel('yearWheel', this.numberRange(today.getFullYear(), 1920), this.dateParts.year);
        this.renderDayWheel();
        this.syncDateInput();
    }

    renderDayWheel() {
        this.wheelLock = true;
        this.renderWheel('dayWheel', this.numberRange(1, this.daysInMonth(this.dateParts.year, this.dateParts.month)), this.dateParts.day);
        this.wheelLock = false;
    }

    renderWheel(id, values, selected) {
        const wheel = document.getElementById(id);
        wheel.innerHTML = '<div class="wheel-pad"></div>' + values.map((value) => {
            return `<div class="wheel-item" data-value="${value}">${value}</div>`;
        }).join('') + '<div class="wheel-pad"></div>';
        const index = Math.max(0, values.indexOf(Number(selected)));
        const apply = () => {
            wheel.scrollTop = index * WHEEL_ITEM;
            this.markWheel(wheel);
        };
        apply();
        requestAnimationFrame(() => requestAnimationFrame(apply));
    }

    readWheel(wheel) {
        const items = [...wheel.querySelectorAll('.wheel-item')];
        if (!items.length) return '';
        const index = Math.max(0, Math.min(items.length - 1, Math.round(wheel.scrollTop / WHEEL_ITEM)));
        return items[index].dataset.value;
    }

    markWheel(wheel) {
        const selected = this.readWheel(wheel);
        wheel.querySelectorAll('.wheel-item').forEach((item) => {
            item.classList.toggle('is-selected', item.dataset.value === String(selected));
        });
    }

    onWheelScroll(id) {
        if (this.wheelLock) return;
        const wheel = document.getElementById(id);
        this.markWheel(wheel);
        clearTimeout(this.wheelTimer);
        this.wheelTimer = setTimeout(() => this.commitWheel(id), 90);
    }

    commitWheel(id) {
        if (this.wheelLock) return;
        const value = Number(this.readWheel(document.getElementById(id)));
        if (!value) return;
        if (id === 'monthWheel') this.dateParts.month = value;
        if (id === 'yearWheel') this.dateParts.year = value;
        if (id === 'dayWheel') this.dateParts.day = value;
        if (id !== 'dayWheel') {
            const maxDay = this.daysInMonth(this.dateParts.year, this.dateParts.month);
            if (this.dateParts.day > maxDay) this.dateParts.day = maxDay;
            this.renderDayWheel();
        }
        this.syncDateInput();
    }

    syncDateInput() {
        const month = String(this.dateParts.month).padStart(2, '0');
        const day = String(this.dateParts.day).padStart(2, '0');
        document.getElementById('noteDateInput').value = `${this.dateParts.year}-${month}-${day}`;
    }

    renderFamilyTree() {
        const person = this.getPerson(this.currentPersonId);
        const tree = document.getElementById('familyTree');
        if (!person || !tree) return;
        const relatives = person.relatives || [];
        const group = (role) => relatives.filter((item) => item.role === role);
        const row = (items) => items.map((item) => this.relativeCard(item)).join('');
        tree.innerHTML = `
            ${this.treeBand('Parents', row(group('parent')))}
            <div class="tree-band">
                <div class="tree-row">
                    ${row(group('partner'))}
                    <div class="tree-card tree-self">${this.escape(person.name)}</div>
                    ${row(group('sibling'))}
                </div>
            </div>
            ${this.treeBand('Children', row(group('child')))}
            ${this.treeBand('Other', row(group('other')))}
        `;
    }

    treeBand(label, cards) {
        if (!cards) return '';
        return `<div class="tree-band"><p class="note-section-label">${label}</p><div class="tree-row">${cards}</div></div>`;
    }

    relativeCard(relative) {
        const role = RELATIVE_ROLES.find((item) => item.id === relative.role);
        return `
            <button type="button" class="tree-card" data-relative-id="${relative.id}">
                <strong>${this.escape(relative.name)}</strong>
                <span>${this.escape(role ? role.label : 'Relative')}</span>
            </button>
        `;
    }

    openRelativeModal(relativeId) {
        const person = this.getPerson(this.currentPersonId);
        if (!person) return;
        const relative = relativeId ? (person.relatives || []).find((item) => item.id === relativeId) : null;
        this.editingRelativeId = relative ? relative.id : null;
        document.getElementById('relativeModalTitle').textContent = relative ? 'Edit relative' : 'Add to tree';
        document.getElementById('relativeNameInput').value = relative ? relative.name : '';
        document.getElementById('relativeRoleInput').value = relative ? relative.role : 'parent';
        document.getElementById('deleteRelativeBtn').classList.toggle('hidden', !relative);
        document.getElementById('relativeModal').classList.remove('hidden');
        document.getElementById('relativeNameInput').focus();
    }

    closeRelativeModal() {
        document.getElementById('relativeModal').classList.add('hidden');
        this.editingRelativeId = null;
    }

    saveRelative() {
        const person = this.getPerson(this.currentPersonId);
        if (!person) return;
        const name = document.getElementById('relativeNameInput').value.trim();
        const role = document.getElementById('relativeRoleInput').value;
        if (!name) {
            alert('Add a name first.');
            return;
        }
        if (!Array.isArray(person.relatives)) person.relatives = [];
        if (this.editingRelativeId) {
            const relative = person.relatives.find((item) => item.id === this.editingRelativeId);
            if (!relative) return;
            relative.name = name;
            relative.role = role;
        } else {
            person.relatives.push({ id: this.uid('r'), name, role });
        }
        this.save();
        this.closeRelativeModal();
        this.renderFamilyTree();
    }

    deleteRelative() {
        const person = this.getPerson(this.currentPersonId);
        if (!person || !this.editingRelativeId) return;
        person.relatives = (person.relatives || []).filter((item) => item.id !== this.editingRelativeId);
        this.save();
        this.closeRelativeModal();
        this.renderFamilyTree();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new KnowMe();
});
