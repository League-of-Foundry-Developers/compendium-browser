/**
 * @author Felix Müller aka syl3r86
 * @version 0.2.0
 */

class SpellBrowser extends Application {

    async initializeContent() {
        // load settings
        if (this.settings === undefined) {
            this.initSettings();
        }
        this.loadItems().then(obj => {
            this.spells = obj;
        });
        this.loadNpcs().then(obj => {
            this.npcs = obj;
        });
        await loadTemplates([
            "modules/compendium-browser/template/spell-browser.html",
            "modules/compendium-browser/template/npc-browser.html",
            "modules/compendium-browser/template/feat-browser.html",
            "modules/compendium-browser/template/item-browser.html",
            "modules/compendium-browser/template/filter-container.html",
            "modules/compendium-browser/template/settings.html"
        ]);

        this.hookCompendiumList();

        this.spellFilters = {
            registeredFilterCategorys: {},
            activeFilters: {}
        };
        this.npcFilters = {
            registeredFilterCategorys: {},
            activeFilters: {}
        };
        this.featFilters = {
            registeredFilterCategorys: {},
            activeFilters: {}
        };
        this.itemFilters = {
            registeredFilterCategorys: {},
            activeFilters: {}
        };
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "spell" }],
            classes: options.classes.concat('compendium-browser'),
            template: "modules/compendium-browser/template/template.html",
            width: 800,
            height: 700,
            resizable: true,
            minimizable: true,
            title: "Compendium Browser"
        });
        return options;
    }

    hookCompendiumList() {
        Hooks.on('renderCompendiumDirectory', (app, html, data) => {
            this.hookCompendiumList();
        });

        let html = $('#compendium');
        if (this.settings === undefined) {
            this.initSettings();
        }
        if (game.user.isGM || this.settings.allowSpellBrowser || this.settings.allowNpcBrowser) {
            const importButton = $(`<button class="compendium-browser-btn"><i class="fas fa-fire"></i> ${game.i18n.localize("CMPBrowser.compendiumBrowser")}</button>`);
            html.find('.compendium-browser-btn').remove();

            // adding to directory-list since the footer doesn't exist if the user is not gm
            html.find('.directory-footer').append(importButton);

            // Handle button clicks
            importButton.click(ev => {
                ev.preventDefault();
                this.render(true);
            });
        }
    }

    async getData() {
        if (!this.spellsLoaded) {
            // spells will be stored locally to not require full loading each time the browser is opened
            this.items = await this.loadItems();
            this.spellsLoaded = true;
        }

        let data = {};
        data.spells = this.items.spells;
        data.spellFilters = this.spellFilters;
        data.showSpellBrowser = (game.user.isGM || this.settings.allowSpellBrowser);
        data.feats = this.items.feats;
        data.featFilters = this.featFilters;
        data.showFeatBrowser = (game.user.isGM || this.settings.allowFeatBrowser);
        data.items = this.items.items;
        data.itemFilters = this.itemFilters;
        data.showItemBrowser = (game.user.isGM || this.settings.allowItemBrowser);
        data.npcs = this.npcs;
        data.npcFilters = this.npcFilters;
        data.showNpcBrowser = (game.user.isGM || this.settings.allowNpcBrowser);
        data.settings = this.settings;
        data.isGM = game.user.isGM;
        return data;
    }

    async loadItems() {
        console.log('Spell Browser | Started loading items');

        if (this.classList === undefined) {
            this.classList = await fetch('modules/compendium-browser/spell-classes.json').then(result => {
                return result.json();
            }).then(obj => {
                return this.classList = obj;
            });
        }

        if (this.packList === undefined) {
            this.packList = await fetch('modules/compendium-browser/item-packs.json').then(result => {
                return result.json();
            }).then(obj => {
                return this.packList = obj;
            });
        }

        if (this.subClasses === undefined) {
            this.subClasses = await fetch('modules/compendium-browser/sub-classes.json').then(result => {
                return result.json();
            }).then(obj => {
                return this.subClasses = obj;
            });
        }

        this.spellsLoaded = false;
        this.spellsLoading = true;

        let unfoundSpells = '';

        let items = {
            spells: {},
            feats: {},
            items: {}
        };



        for (let pack of game.packs) {
            if (pack['metadata']['entity'] == "Item" && this.settings.loadedSpellCompendium[pack.collection].load) {
                await pack.getContent().then(content => {
                    for (let item5e of content) {
                        let item = item5e.data;
                        if (item.type == 'spell') {

                            item.compendium = pack.collection;

                            // determining classes that can use the spell
                            let cleanSpellName = item.name.toLowerCase().replace(/[^一-龠ぁ-ゔァ-ヴーa-zA-Z0-9ａ-ｚＡ-Ｚ０-９々〆〤]/g, '').replace("'", '').replace(/ /g, '');
                            //let cleanSpellName = spell.name.toLowerCase().replace(/[^a-zA-Z0-9\s:]/g, '').replace("'", '').replace(/ /g, '');
                            if (this.classList[cleanSpellName] !== undefined) {
                                let classes = this.classList[cleanSpellName];
                                item.data.classes = classes.split(',');
                            } else {
                                unfoundSpells += cleanSpellName + ',';
                            }

                            // getting damage types
                            item.damageTypes = [];
                            if (item.data.damage && item.data.damage.parts.length > 0) {
                                for (let part of item.data.damage.parts) {
                                    let type = part[1];
                                    if (item.damageTypes.indexOf(type) === -1) {
                                        item.damageTypes.push(type);
                                    }
                                }
                            }

                            items.spells[(item._id)] = item;
                        } else  if (item.type == 'feat' || item.type == 'class') {
                            item.compendium = pack.collection;
                            // getting damage types
                            item.damageTypes = [];
                            if (item.data.damage && item.data.damage.parts.length > 0) {
                                for (let part of item.data.damage.parts) {
                                    let type = part[1];
                                    if (item.damageTypes.indexOf(type) === -1) {
                                        item.damageTypes.push(type);
                                    }
                                }
                            }

                            // getting class
                            let reqString = item.data.requirements?.replace(/[0-9]/g, '').trim();
                            let matchedClass = [];
                            for (let c in this.subClasses) {
                                if (reqString && reqString.toLowerCase().indexOf(c) !== -1) {
                                    matchedClass.push(c);
                                } else {
                                    for (let subClass of this.subClasses[c]) {
                                        if (reqString && reqString.indexOf(subClass) !== -1) {
                                            matchedClass.push(c);
                                            break;
                                        }
                                    }
                                }
                            }
                            item.classRequirement = matchedClass;
                            item.classRequirementString = matchedClass.join(', ');

                            // getting uses/ressources status
                            item.usesRessources = item5e.hasLimitedUses;

                            item.hasSave = item5e.hasSave;


                            items.feats[(item._id)] = item;
                        } else {
                            item.compendium = pack.collection;
                            // getting damage types
                            item.damageTypes = [];
                            if (item.data.damage && item.data.damage.parts.length > 0) {
                                for (let part of item.data.damage.parts) {
                                    let type = part[1];
                                    if (item.damageTypes.indexOf(type) === -1) {
                                        item.damageTypes.push(type);
                                    }
                                }
                            }

                            // getting pack
                            let matchedPacks = [];
                            for (let pack in this.packList) {
                                for (let packItem of this.packList[pack]) {
                                    if (item.name.toLowerCase() === packItem.toLowerCase()) {
                                        matchedPacks.push(pack);
                                        break;
                                    }
                                }
                            }
                            item.matchedPacks = matchedPacks;
                            item.matchedPacksString = matchedPacks.join(', ');

                            // getting uses/ressources status
                            item.usesRessources = item5e.hasLimitedUses

                            items.items[(item._id)] = item;
                        }
                    }
                });
            }
        }
        if (unfoundSpells !== '') {
            console.log(`Spell Browser | List of Spells that don't have a class assosiated to them:`);
            console.log(unfoundSpells);
        }
        console.log('Spell Browser | Finished loading items');
        return items;
    }

    async loadNpcs() {
        console.log('NPC Browser | Started loading NPCs');

        let npcs = {};

        for (let pack of game.packs) {
            if (pack['metadata']['entity'] == "Actor" && this.settings.loadedNpcCompendium[pack.collection].load) {
                await pack.getContent().then(async content => {

                    for (let npc of content) {
                        //console.log('%c '+npc.name, 'background: white; color: red')
                        npc = npc.data;
                        // add needed data
                        npc.compendium = pack.collection;
                        // cr display
                        let cr = npc.data.details.cr;
                        if (cr == undefined || cr == '') cr = 0;
                        else cr = Number(cr);
                        if (cr > 0 && cr < 1) cr = "1/" + (1 / cr);
                        npc.displayCR = cr;
                        npc.displaySize = 'unset';
                        npc.filterSize = 2;
                        if (CONFIG.DND5E.actorSizes[npc.data.traits.size] !== undefined) {
                            npc.displaySize = CONFIG.DND5E.actorSizes[npc.data.traits.size];
                        }
                        switch (npc.data.traits.size) {
                            case 'grg': npc.filterSize = 5; break;
                            case 'huge': npc.filterSize = 4; break;
                            case 'lg': npc.filterSize = 3; break;
                            case 'sm': npc.filterSize = 1; break;
                            case 'tiny': npc.filterSize = 0; break;
                            case 'med':
                            default: npc.filterSize = 2; break;
                        }

                        // getting value for HasSpells and damage types
                        npc.hasSpells = false;
                        npc.damageDealt = [];
                        for (let item of npc.items) {
                            if (item.type == 'spell') {
                                npc.hasSpells = true;
                            }
                            if (item.data.damage && item.data.damage.parts && item.data.damage.parts.length > 0) {
                                for (let part of item.data.damage.parts) {
                                    let type = part[1];
                                    if (npc.damageDealt.indexOf(type) === -1) {
                                        npc.damageDealt.push(type);
                                    }
                                }
                            }
                        }

                        npcs[npc._id] = npc;
                    }
                });
            }
        }
        console.log('NPC Browser | Finished loading NPCs');
        return npcs;
    }

    activateListeners(html) {
        super.activateListeners(html);
        // localizing title
        $(html).parents('.app').find('.window-title')[0].innerText = game.i18n.localize("CMPBrowser.compendiumBrowser");

        // show entity sheet
        html.find('.item-edit').click(ev => {
            let itemId = $(ev.currentTarget).parents("li").attr("data-entry-id");
            let compendium = $(ev.currentTarget).parents("li").attr("data-entry-compendium");
            let pack = game.packs.find(p => p.collection === compendium);
            pack.getEntity(itemId).then(entity => {
                entity.sheet.render(true);
            });
        });

        // make draggable
        html.find('.draggable').each((i, li) => {
            li.setAttribute("draggable", true);
            li.addEventListener('dragstart', event => {
                let packName = li.getAttribute("data-entry-compendium");
                let pack = game.packs.find(p => p.collection === packName);
                if (!pack) {
                    event.preventDefault();
                    return false;
                }
                event.dataTransfer.setData("text/plain", JSON.stringify({
                    type: pack.entity,
                    pack: pack.collection,
                    id: li.getAttribute("data-entry-id")
                }));
            }, false);
        });

        // toggle visibility of filter containers
        html.find('.filtercontainer h3, .multiselect label').click(async ev => {
            await $(ev.target.nextElementSibling).toggle(100);

        });
        html.find('.multiselect label').trigger('click');

        // sort spell list
        html.find('.spell-browser select[name=sortorder]').on('change', ev => {
            let spellList = html.find('.spell-browser li');
            let byName = (ev.target.value == 'true');
            let sortedList = this.sortSpells(spellList, byName);
            let ol = $(html.find('.spell-browser ul'));
            ol[0].innerHTML = [];
            for (let element of sortedList) {
                ol[0].append(element);
            }
        });
        html.find('.spell-browser select[name=sortorder]').trigger('change');

        // sort feat list
        html.find('.feat-browser select[name=sortorder]').on('change', ev => {
            let featList = html.find('.feat-browser li');
            let byName = (ev.target.value == 'true');
            let sortedList = this.sortFeats(featList, byName);
            let ol = $(html.find('.feat-browser ul'));
            ol[0].innerHTML = [];
            for (let element of sortedList) {
                ol[0].append(element);
            }
        });
        html.find('.feat-browser select[name=sortorder]').trigger('change');

        // sort item list
        html.find('.item-browser select[name=sortorder]').on('change', ev => {
            let itemList = html.find('.item-browser li');
            let byName = (ev.target.value == 'true');
            let sortedList = this.sortItems(itemList, byName);
            let ol = $(html.find('.item-browser ul'));
            ol[0].innerHTML = [];
            for (let element of sortedList) {
                ol[0].append(element);
            }
        });
        html.find('.item-browser select[name=sortorder]').trigger('change');

        // sort npc list
        html.find('.npc-browser select[name=sortorder]').on('change', ev => {
            let npcList = html.find('.npc-browser li');
            let orderBy = ev.target.value;
            let sortedList = this.sortNpcs(npcList, orderBy);
            let ol = $(html.find('.npc-browser ul'));
            ol[0].innerHTML = [];
            for (let element of sortedList) {
                ol[0].append(element);
            }
        });
        html.find('.npc-browser select[name=sortorder]').trigger('change')

        // reset filters
        html.find('#reset-spell-filter').click(ev => {
            this.spellFilters.activeFilters = {};
            this.render();
        });

        html.find('#reset-feat-filter').click(ev => {
            this.featFilters.activeFilters = {};
            this.render();
        });

        html.find('#reset-item-filter').click(ev => {
            this.itemFilters.activeFilters = {};
            this.render();
        });

        html.find('#reset-npc-filter').click(ev => {
            this.npcFilters.activeFilters = {};
            this.render();
        });

        // settings
        html.find('.settings input').on('change', ev => {
            let setting = ev.target.dataset.setting;
            let value = ev.target.checked;
            if (setting === 'spell-compendium-setting') {
                let key = ev.target.dataset.key;
                this.settings.loadedSpellCompendium[key].load = value;
                this.loadItems().then((spells) => {
                    this.spells = spells;
                    this.render();
                });
                ui.notifications.info("Settings Saved. Spell Compendiums are being reloaded.");
            } else if (setting === 'npc-compendium-setting') {
                let key = ev.target.dataset.key;
                this.settings.loadedNpcCompendium[key].load = value;
                this.loadNpcs().then((npcs) => {
                    this.npcs = npcs;
                    this.render();
                });
                ui.notifications.info("Settings Saved. NPC Compendiums are being reloaded.");
            }
            if (setting === 'allow-spell-browser') {
                this.settings.allowSpellBrowser = value;
            }
            if (setting === 'allow-feat-browser') {
                this.settings.allowFeatBrowser = value;
            }
            if (setting === 'allow-item-browser') {
                this.settings.allowItemBrowser = value;
            }
            if (setting === 'allow-npc-browser') {
                this.settings.allowNpcBrowser = value;
            }
            this.saveSettings();
        });


        // activating or deactivating filters

        // text filters

        html.find('.filter[data-type=text] input, .filter[data-type=text] select').on('keyup change paste', ev => {
            let path = $(ev.target).parents('.filter').data('path');
            let key = path.replace(/\./g, '');
            let value = ev.target.value;
            let itemType = $(ev.target).parents('.tab').data('tab');

            let filterTarget = `${itemType}Filters`;

            if (value === '' || value === undefined) {
                delete this[filterTarget].activeFilters[key];
            } else {
                this[filterTarget].activeFilters[key] = {
                    path: path,
                    type: 'text',
                    valIsArray: false,
                    value: ev.target.value
                }
            }

            let list = null;
            let subjects = null;
            if (itemType === 'spell') {
                list = html.find('.spell-browser li');
                subjects = this.items.spells;
            } else if (itemType === 'npc') {
                list = html.find('.npc-browser li');
                subjects = this.npcs;
            } else if (itemType === 'feat') {
                list = html.find('.feat-browser li');
                subjects = this.items.feats;
            } else if (itemType === 'item') {
                list = html.find('.item-browser li');
                subjects = this.items.items;
            }
            this.filterElements(list, subjects, this[filterTarget].activeFilters);
        });

        // select filters
        html.find('.filter[data-type=select] select, .filter[data-type=bool] select').on('change', ev => {
            let path = $(ev.target).parents('.filter').data('path');
            let key = path.replace(/\./g, '');
            let filterType = $(ev.target).parents('.filter').data('type');
            let itemType = $(ev.target).parents('.tab').data('tab');
            let valIsArray = $(ev.target).parents('.filter').data('valisarray');
            if (valIsArray === 'true') valIsArray = true;
            let value = ev.target.value;
            if (value === 'false') value = false;
            if (value === 'true') value = true;

            let filterTarget = `${itemType}Filters`;

            if (value === "null") {
                delete this[filterTarget].activeFilters[key]
            } else {
                this[filterTarget].activeFilters[key] = {
                    path: path,
                    type: filterType,
                    valIsArray: valIsArray,
                    value:value
                }
            }

            let list = null;
            let subjects = null;
            if (itemType === 'spell') {
                list = html.find('.spell-browser li');
                subjects = this.items.spells;
            } else if (itemType === 'npc') {
                list = html.find('.npc-browser li');
                subjects = this.npcs;
            } else if (itemType === 'feat') {
                list = html.find('.feat-browser li');
                subjects = this.items.feats;
            } else if (itemType === 'item') {
                list = html.find('.item-browser li');
                subjects = this.items.items;
            }
            this.filterElements(list, subjects, this[filterTarget].activeFilters);
        });

        // multiselect filters
        html.find('.filter[data-type=multiSelect] input').on('change', ev => {
            let path = $(ev.target).parents('.filter').data('path');
            let key = path.replace(/\./g, '');
            let filterType = 'multiSelect';
            let itemType = $(ev.target).parents('.tab').data('tab');
            let valIsArray = $(ev.target).parents('.filter').data('valisarray');
            if (valIsArray === 'true') valIsArray = true;
            let value = $(ev.target).data('value');

            let filterTarget = `${itemType}Filters`;
            let filter = this[filterTarget].activeFilters[key];

            if (ev.target.checked === true) {
                if (filter === undefined) {
                    this[filterTarget].activeFilters[key] = {
                        path: path,
                        type: filterType,
                        valIsArray: valIsArray,
                        values: [ value ]
                    }
                } else {
                    this[filterTarget].activeFilters[key].values.push(value);
                }
            } else {
                delete this[filterTarget].activeFilters[key].values.splice(this[filterTarget].activeFilters[key].values.indexOf(value),1);
                if (this[filterTarget].activeFilters[key].values.length === 0) {
                    delete this[filterTarget].activeFilters[key];
                }
            }

            let list = null;
            let subjects = null;
            if (itemType === 'spell') {
                list = html.find('.spell-browser li');
                subjects = this.items.spells;
            } else if (itemType === 'npc') {
                list = html.find('.npc-browser li');
                subjects = this.npcs;
            } else if (itemType === 'feat') {
                list = html.find('.feat-browser li');
                subjects = this.items.feats;
            } else if (itemType === 'item') {
                list = html.find('.item-browser li');
                subjects = this.items.items;
            }
            this.filterElements(list, subjects, this[filterTarget].activeFilters);
        });


        html.find('.filter[data-type=numberCompare] select, .filter[data-type=numberCompare] input').on('change keyup paste', ev => {
            let path = $(ev.target).parents('.filter').data('path');
            let key = path.replace(/\./g, '');
            let filterType = 'numberCompare';
            let itemType = $(ev.target).parents('.tab').data('tab');
            let valIsArray = false;

            let operator = $(ev.target).parents('.filter').find('select').val();
            let value = $(ev.target).parents('.filter').find('input').val();

            let filterTarget = `${itemType}Filters`;

            if (value === '' || operator === 'null') {
                delete this[filterTarget].activeFilters[key]
            } else {
                this[filterTarget].activeFilters[key] = {
                    path: path,
                    type: filterType,
                    valIsArray: valIsArray,
                    operator: operator,
                    value: value
                }
            }

            let list = null;
            let subjects = null;
            if (itemType === 'spell') {
                list = html.find('.spell-browser li');
                subjects = this.items.spells;
            } else if (itemType === 'npc') {
                list = html.find('.npc-browser li');
                subjects = this.npcs;
            } else if (itemType === 'feat') {
                list = html.find('.feat-browser li');
                subjects = this.items.feats;
            } else if (itemType === 'item') {
                list = html.find('.item-browser li');
                subjects = this.items.items;
            }
            this.filterElements(list, subjects, this[filterTarget].activeFilters);
        });


        // lazy load images
        const observer = new IntersectionObserver((entries, observer) => {
            for (let e of entries) {
                if (!e.isIntersecting) continue;
                const img = e.target;
                // Avatar image
                //const img = li.querySelector("img");
                if (img && img.dataset.src) {
                    img.src = img.dataset.src;
                    delete img.dataset.src;
                }

                // No longer observe the target
                observer.unobserve(e.target);
            }
        });
        html.find("img").each((i, img) => observer.observe(img));
    }

    sortSpells(list, byName) {
        if(byName) {
            list.sort((a, b) => {
                let aName = $(a).find('.item-name a')[0].innerHTML;
                let bName = $(b).find('.item-name a')[0].innerHTML;
                if (aName < bName) return -1;
                if (aName > bName) return 1;
                return 0;
            });
        } else {
            list.sort((a, b) => {
                let aVal = $(a).find('input[name=level]').val();
                let bVal = $(b).find('input[name=level]').val();
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
                if (aVal == bVal) {
                    let aName = $(a).find('.item-name a')[0].innerHTML;
                    let bName = $(b).find('.item-name a')[0].innerHTML;
                    if (aName < bName) return -1;
                    if (aName > bName) return 1;
                    return 0;
                }
            });
        }
        return list;
    }

    sortFeats(list, byName) {
        if (byName) {
            list.sort((a, b) => {
                let aName = $(a).find('.item-name a')[0].innerHTML;
                let bName = $(b).find('.item-name a')[0].innerHTML;
                if (aName < bName) return -1;
                if (aName > bName) return 1;
                return 0;
            });
        } else {
            list.sort((a, b) => {
                let aVal = $(a).find('input[name=class]').val();
                let bVal = $(b).find('input[name=class]').val();
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
                if (aVal == bVal) {
                    let aName = $(a).find('.item-name a')[0].innerHTML;
                    let bName = $(b).find('.item-name a')[0].innerHTML;
                    if (aName < bName) return -1;
                    if (aName > bName) return 1;
                    return 0;
                }
            });
        }
        return list;
    }

    sortItems(list, byName) {
        if (byName) {
            list.sort((a, b) => {
                let aName = $(a).find('.item-name a')[0].innerHTML;
                let bName = $(b).find('.item-name a')[0].innerHTML;
                if (aName < bName) return -1;
                if (aName > bName) return 1;
                return 0;
            });
        } else {
            list.sort((a, b) => {
                let aVal = $(a).find('input[name=type]').val();
                let bVal = $(b).find('input[name=type]').val();
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
                if (aVal == bVal) {
                    let aName = $(a).find('.item-name a')[0].innerHTML;
                    let bName = $(b).find('.item-name a')[0].innerHTML;
                    if (aName < bName) return -1;
                    if (aName > bName) return 1;
                    return 0;
                }
            });
        }
        return list;
    }

    sortNpcs(list, orderBy) {
        switch (orderBy) {
            case 'name':
                list.sort((a, b) => {
                    let aName = $(a).find('.npc-name a')[0].innerHTML;
                    let bName = $(b).find('.npc-name a')[0].innerHTML;
                    if (aName < bName) return -1;
                    if (aName > bName) return 1;
                    return 0;
                }); break;
            case 'cr':
                list.sort((a, b) => {
                    let aVal = Number($(a).find('input[name="order.cr"]').val());
                    let bVal = Number($(b).find('input[name="order.cr"]').val());
                    if (aVal < bVal) return -1;
                    if (aVal > bVal) return 1;
                    if (aVal == bVal) {
                        let aName = $(a).find('.npc-name a')[0].innerHTML;
                        let bName = $(b).find('.npc-name a')[0].innerHTML;
                        if (aName < bName) return -1;
                        if (aName > bName) return 1;
                        return 0;
                    }
                }); break;
            case 'size':
                list.sort((a, b) => {
                    let aVal = $(a).find('input[name="order.size"]').val();
                    let bVal = $(b).find('input[name="order.size"]').val();
                    if (aVal < bVal) return -1;
                    if (aVal > bVal) return 1;
                    if (aVal == bVal) {
                        let aName = $(a).find('.npc-name a')[0].innerHTML;
                        let bName = $(b).find('.npc-name a')[0].innerHTML;
                        if (aName < bName) return -1;
                        if (aName > bName) return 1;
                        return 0;
                    }
                }); break;
        }
        return list;
    }

    filterElements(list, subjects, filters) {
        for (let element of list) {
            let subject = subjects[element.dataset.entryId];
            if (this.getFilterResult(subject, filters) == false) {
                $(element).hide();
            } else {
                $(element).show();
            }
        }
    }

    getFilterResult(subject, filters) {
        for (let filterKey in filters) {
            let filter = filters[filterKey];
            let prop = getProperty(subject, filter.path);
            if (filter.type === 'numberCompare') {

                switch (filter.operator) {
                    case '=': if (prop != filter.value) { return false; } break;
                    case '<': if (prop >= filter.value) { return false; } break;
                    case '>': if (prop <= filter.value) { return false; } break;
                }

                continue;
            }
            if (filter.valIsArray === false) {
                if (filter.type === 'text') {
                    if (prop === undefined) return false;
                    if (prop.toLowerCase().indexOf(filter.value.toLowerCase()) === -1) {
                        return false;
                    }
                } else {
                    if (filter.value !== undefined && prop !== undefined && prop != filter.value && !(filter.value === true && prop)) {
                        return false;
                    }
                    if (filter.values && filter.values.indexOf(prop) === -1) {
                        return false;
                    }
                }
            } else {
                if (prop === undefined) return false;
                if (typeof prop === 'object') {
                    if (filter.value) {
                        if (prop.indexOf(filter.value) === -1) {
                            return false;
                        }
                    } else if(filter.values) {
                        for (let val of filter.values) {
                            if (prop.indexOf(val) !== -1) {
                                continue;
                            }
                            return false;
                        }
                    }
                } else {
                    for (let val of filter.values) {
                        if (prop === val) {
                            continue;
                        }
                    }
                    return false;
                }
            }
        }

        return true;
    }

    clearObject(obj) {
        let newObj = {};
        for (let key in obj) {
            if (obj[key] == true) {
                newObj[key] = true;
            }
        }
        return newObj;
    }

    initSettings() {
        let defaultSettings = {
            loadedSpellCompendium: {},
            loadedNpcCompendium: {},
        };
        for (let compendium of game.packs) {
            if (compendium['metadata']['entity'] == "Item") {
                defaultSettings.loadedSpellCompendium[compendium.collection] = {
                    load: true,
                    name: `${compendium['metadata']['label']} (${compendium.collection})`
                };
            }
            if (compendium['metadata']['entity'] == "Actor") {
                defaultSettings.loadedNpcCompendium[compendium.collection] = {
                    load: true,
                    name: `${compendium['metadata']['label']} (${compendium.collection})`
                };
            }
        }
        // creating game setting container
        game.settings.register("compendiumBrowser", "settings", {
            name: "Compendium Browser Settings",
            hint: "Settings to exclude packs from loading and visibility of the browser",
            default: defaultSettings,
            type: Object,
            scope: 'world',
            onChange: settings => {
                this.settings = settings;
            }
        });

        // load settings from container and apply to default settings (available compendie might have changed)
        let settings = game.settings.get('compendiumBrowser', 'settings');
        for (let compKey in defaultSettings.loadedSpellCompendium) {
            if (settings.loadedSpellCompendium[compKey] !== undefined) {
                defaultSettings.loadedSpellCompendium[compKey].load = settings.loadedSpellCompendium[compKey].load;
            }
        }
        for (let compKey in defaultSettings.loadedNpcCompendium) {
            if (settings.loadedNpcCompendium[compKey] !== undefined) {
                defaultSettings.loadedNpcCompendium[compKey].load = settings.loadedNpcCompendium[compKey].load;
            }
        }
        defaultSettings.allowSpellBrowser = settings.allowSpellBrowser ? true : false;
        defaultSettings.allowFeatBrowser = settings.allowFeatBrowser ? true : false;
        defaultSettings.allowItemBrowser = settings.allowItemBrowser ? true : false;
        defaultSettings.allowNpcBrowser = settings.allowNpcBrowser ? true : false;

        if (game.user.isGM) {
            game.settings.set('compendiumBrowser', 'settings', defaultSettings);
            console.log("New default settings set");
            console.log(defaultSettings);
        }
        this.settings = defaultSettings;
    }

    saveSettings() {
        game.settings.set('compendiumBrowser', 'settings', this.settings);
    }

    addFilter(entityType, category, label, path, type, possibleValues = null, valIsArray = false) {
        let target = `${entityType}Filters`;
        let filter = {};
        filter.path = path;
        filter.label = label;
        filter.type = 'text';
        if (['text', 'bool', 'select', 'multiSelect', 'numberCompare'].indexOf(type) !== -1) {
            filter[`is${type}`] = true;
            filter.type = type;
        }
        if (possibleValues !== null) {
            filter.possibleValues = possibleValues;
        }
        filter.valIsArray = valIsArray;

        let catId = category.replace(/\W/g, '');
        if (this[target].registeredFilterCategorys[catId] === undefined) {
            this[target].registeredFilterCategorys[catId] = { label: category, filters: [] };
        }
        this[target].registeredFilterCategorys[catId].filters.push(filter);

    }

    _lazyLoadImg(entries, observer) {
    }

    /**
     * Used to add custom filters to the Spell-Browser
     * @param {String} category - Title of the category
     * @param {String} label - Title of the filter
     * @param {String} path - path to the data that the filter uses. uses dotnotation. example: data.abilities.dex.value
     * @param {String} type - type of filter
     *                      possible filter:
     *                          text:           will give a textinput (or use a select if possibleValues has values) to compare with the data. will use objectData.indexOf(searchedText) to enable partial matching
     *                          bool:           will see if the data at the path exists and not false.
     *                          select:         exactly matches the data with the chosen selector from possibleValues
     *                          multiSelect:    enables selecting multiple values from possibleValues, any of witch has to match the objects data
     *                          numberCompare:  gives the option to compare numerical values, either with =, < or the > operator
     * @param {Boolean} possibleValues - predetermined values to choose from. needed for select and multiSelect, can be used in text filters
     * @param {Boolean} valIsArray - if the objects data is an object use this. the filter will check each property in the object (not recursive). if no match is found, the object will be hidden
     */
    addSpellFilter(category, label, path, type, possibleValues = null, valIsArray = false) {
        this.addFilter('spell', category, label, path, type, possibleValues, valIsArray);
    }

    /**
     * Used to add custom filters to the Spell-Browser
     * @param {String} category - Title of the category
     * @param {String} label - Title of the filter
     * @param {String} path - path to the data that the filter uses. uses dotnotation. example: data.abilities.dex.value
     * @param {String} type - type of filter
     *                      possible filter:
     *                          text:           will give a textinput (or use a select if possibleValues has values) to compare with the data. will use objectData.indexOf(searchedText) to enable partial matching
     *                          bool:           will see if the data at the path exists and not false.
     *                          select:         exactly matches the data with the chosen selector from possibleValues
     *                          multiSelect:    enables selecting multiple values from possibleValues, any of witch has to match the objects data
     *                          numberCompare:  gives the option to compare numerical values, either with =, < or the > operator
     * @param {Boolean} possibleValues - predetermined values to choose from. needed for select and multiSelect, can be used in text filters
     * @param {Boolean} valIsArray - if the objects data is an object use this. the filter will check each property in the object (not recursive). if no match is found, the object will be hidden
     */
    addNpcFilter(category, label, path, type, possibleValues = null, valIsArray = false) {
        this.addFilter('npc', category, label, path, type, possibleValues, valIsArray);
    }

    addFeatFilter(category, label, path, type, possibleValues = null, valIsArray = false) {
        this.addFilter('feat', category, label, path, type, possibleValues, valIsArray);
    }

    addItemFilter(category, label, path, type, possibleValues = null, valIsArray = false) {
        this.addFilter('item', category, label, path, type, possibleValues, valIsArray);
    }
}

Hooks.on('ready', async function() {

    if (game.compendiumBrowser === undefined) {
        game.compendiumBrowser = new SpellBrowser();
        await game.compendiumBrowser.initializeContent();
    }

    // Spellfilters

    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("DND5E.Source"), 'data.source', 'text');
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.lvl"), 'data.level', 'multiSelect', [game.i18n.localize("CMPBrowser.cantip"), 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.school"), 'data.school', 'select', CONFIG.DND5E.spellSchools);
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.castingTime"), 'data.activation.type', 'select',
        {
            action: game.i18n.localize("DND5E.Action"),
            bonus: game.i18n.localize("CMPBrowser.bonusAction"),
            reaction: game.i18n.localize("CMPBrowser.reaction"),
            minute: game.i18n.localize("DND5E.TimeMinute"),
            hour: game.i18n.localize("DND5E.TimeHour"),
            day: game.i18n.localize("DND5E.TimeDay")
        });
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.spellType"), 'data.actionType', 'select', CONFIG.DND5E.itemActionTypes);
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.damageType"), 'damageTypes', 'select', CONFIG.DND5E.damageTypes);
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.class"), 'data.classes', 'select',
        {
            artificer: game.i18n.localize("CMPBrowser.artificer"),
            bard: game.i18n.localize("CMPBrowser.bard"),
            cleric: game.i18n.localize("CMPBrowser.cleric"),
            druid: game.i18n.localize("CMPBrowser.druid"),
            fighter: game.i18n.localize("CMPBrowser.fighter"),
            monk: game.i18n.localize("CMPBrowser.monk"),
            paladin: game.i18n.localize("CMPBrowser.paladin"),
            rogue: game.i18n.localize("CMPBrowser.rogue"),
            ranger: game.i18n.localize("CMPBrowser.ranger"),
            sorcerer: game.i18n.localize("CMPBrowser.sorcerer"),
            warlock: game.i18n.localize("CMPBrowser.warlock"),
            wizard: game.i18n.localize("CMPBrowser.wizard"),
        }, true);

    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.components"), game.i18n.localize("CMPBrowser.ritual"), 'data.components.ritual', 'bool');
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.components"), game.i18n.localize("CMPBrowser.concentration"), 'data.components.concentration', 'bool');
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.components"), game.i18n.localize("CMPBrowser.verbal"), 'data.components.vocal', 'bool');
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.components"), game.i18n.localize("CMPBrowser.somatic"), 'data.components.somatic', 'bool');
    game.compendiumBrowser.addSpellFilter(game.i18n.localize("CMPBrowser.components"), game.i18n.localize("CMPBrowser.material"), 'data.components.material', 'bool');

    // Feature Filters

    game.compendiumBrowser.addFeatFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("DND5E.Source"), 'data.source', 'text');
    game.compendiumBrowser.addFeatFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.class"), 'classRequirement', 'select',
        {
            artificer: game.i18n.localize("CMPBrowser.artificer"),
            bard: game.i18n.localize("CMPBrowser.bard"),
            cleric: game.i18n.localize("CMPBrowser.cleric"),
            druid: game.i18n.localize("CMPBrowser.druid"),
            fighter: game.i18n.localize("CMPBrowser.fighter"),
            monk: game.i18n.localize("CMPBrowser.monk"),
            paladin: game.i18n.localize("CMPBrowser.paladin"),
            rogue: game.i18n.localize("CMPBrowser.rogue"),
            ranger: game.i18n.localize("CMPBrowser.ranger"),
            sorcerer: game.i18n.localize("CMPBrowser.sorcerer"),
            warlock: game.i18n.localize("CMPBrowser.warlock"),
            wizard: game.i18n.localize("CMPBrowser.wizard"),
        }, true);

    game.compendiumBrowser.addFeatFilter("Game Mechanics", game.i18n.localize("DND5E.ItemActivationCost"), 'data.activation.type', 'select', CONFIG.DND5E.abilityActivationTypes);
    game.compendiumBrowser.addFeatFilter("Game Mechanics", game.i18n.localize("CMPBrowser.damageType"), 'damageTypes', 'select', CONFIG.DND5E.damageTypes);
    game.compendiumBrowser.addFeatFilter("Game Mechanics", "Uses Resources", 'usesRessources', 'bool');


    // Item Filters

    game.compendiumBrowser.addItemFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("DND5E.Source"), 'data.source', 'text');
    game.compendiumBrowser.addItemFilter(game.i18n.localize("CMPBrowser.general"), "Item Type", 'type', 'select', {
        consumable: game.i18n.localize("DND5E.ItemTypeConsumable"),
        backpack: game.i18n.localize("DND5E.ItemTypeContainer"),
        equipment: game.i18n.localize("DND5E.ItemTypeEquipment"),
        loot: game.i18n.localize("DND5E.ItemTypeLoot"),
        tool: game.i18n.localize("DND5E.ItemTypeTool"),
        weapon: game.i18n.localize("DND5E.ItemTypeWeapon")
    });
    game.compendiumBrowser.addItemFilter(game.i18n.localize("CMPBrowser.general"), "Packs", 'matchedPacks', 'select',
        {
            burglar: "Burglar's Pack",
            diplomat: "Diplomat's Pack",
            dungeoneer: "Dungeoneer's Pack",
            entertainer: "Entertainer's Pack",
            explorer: "Explorer's Pack",
            monsterhunter: "Monster Hunter's Pack",
            priest: "Priest's Pack",
            scholar: "Scholar's Pack",
        }, true);

    game.compendiumBrowser.addItemFilter("Game Mechanics", game.i18n.localize("DND5E.ItemActivationCost"), 'data.activation.type', 'select', CONFIG.DND5E.abilityActivationTypes);
    game.compendiumBrowser.addItemFilter("Game Mechanics", game.i18n.localize("CMPBrowser.damageType"), 'damageTypes', 'select', CONFIG.DND5E.damageTypes);
    game.compendiumBrowser.addItemFilter("Game Mechanics", "Uses Resources", 'usesRessources', 'bool');

    game.compendiumBrowser.addItemFilter("Item Subtype", "Weapon", 'data.weaponType', 'text', CONFIG.DND5E.weaponTypes);
    game.compendiumBrowser.addItemFilter("Item Subtype", "Equipment", 'data.armor.type', 'text', CONFIG.DND5E.equipmentTypes);
    game.compendiumBrowser.addItemFilter("Item Subtype", "Consumable", 'data.consumableType', 'text', CONFIG.DND5E.consumableTypes);

    game.compendiumBrowser.addItemFilter("Magic Items", "Rarity", 'data.rarity', 'select', {
        Common: "Common",
        Uncommon: "Uncommon",
        Rare: "Rare",
        "Very rare": "Very Rare",
        Legendary: "Legendary"
    });

    // NPC Filters

    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("DND5E.Source"), 'data.details.source', 'text');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.size"), 'data.traits.size', 'select', CONFIG.DND5E.actorSizes);
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.hasSpells"), 'hasSpells', 'bool');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.hasLegAct"), 'data.resources.legact.max', 'bool');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.hasLegRes"), 'data.resources.legres.max', 'bool');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.cr"), 'data.details.cr', 'numberCompare');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.general"), game.i18n.localize("CMPBrowser.creatureType"), 'data.details.type', 'text', {
        aberration: game.i18n.localize("CMPBrowser.aberration"),
        beast: game.i18n.localize("CMPBrowser.beast"),
        celestial: game.i18n.localize("CMPBrowser.celestial"),
        construct: game.i18n.localize("CMPBrowser.construct"),
        dragon: game.i18n.localize("CMPBrowser.dragon"),
        elemental: game.i18n.localize("CMPBrowser.elemental"),
        fey: game.i18n.localize("CMPBrowser.fey"),
        fiend: game.i18n.localize("CMPBrowser.fiend"),
        giant: game.i18n.localize("CMPBrowser.giant"),
        humanoid: game.i18n.localize("CMPBrowser.humanoid"),
        monstrosity: game.i18n.localize("CMPBrowser.monstrosity"),
        ooze: game.i18n.localize("CMPBrowser.ooze"),
        plant: game.i18n.localize("CMPBrowser.plant"),
        undead: game.i18n.localize("CMPBrowser.undead")
    });

    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.abilities"), game.i18n.localize("DND5E.AbilityStr"), 'data.abilities.str.value', 'numberCompare');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.abilities"), game.i18n.localize("DND5E.AbilityDex"), 'data.abilities.dex.value', 'numberCompare');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.abilities"), game.i18n.localize("DND5E.AbilityCon"), 'data.abilities.con.value', 'numberCompare');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.abilities"), game.i18n.localize("DND5E.AbilityInt"), 'data.abilities.int.value', 'numberCompare');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.abilities"), game.i18n.localize("DND5E.AbilityWis"), 'data.abilities.wis.value', 'numberCompare');
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.abilities"), game.i18n.localize("DND5E.AbilityCha"), 'data.abilities.cha.value', 'numberCompare');

    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.dmgInteraction"), game.i18n.localize("DND5E.DamImm"), 'data.traits.di.value', 'multiSelect', CONFIG.DND5E.damageTypes, true);
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.dmgInteraction"), game.i18n.localize("DND5E.DamRes"), 'data.traits.dr.value', 'multiSelect', CONFIG.DND5E.damageTypes, true);
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.dmgInteraction"), game.i18n.localize("DND5E.DamVuln"), 'data.traits.dv.value', 'multiSelect', CONFIG.DND5E.damageTypes, true);
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.dmgInteraction"), game.i18n.localize("DND5E.ConImm"), 'data.traits.ci.value', 'multiSelect', CONFIG.DND5E.conditionTypes, true);
    game.compendiumBrowser.addNpcFilter(game.i18n.localize("CMPBrowser.dmgInteraction"), game.i18n.localize("CMPBrowser.dmgDealt"), 'damageDealt', 'multiSelect', CONFIG.DND5E.damageTypes, true);
});
