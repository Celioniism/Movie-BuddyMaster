$(document).ready(() => {
    let popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    let popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl)
    });

    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    var offcanvasElementList = [].slice.call(document.querySelectorAll('.offcanvas'))
    var offcanvasList = offcanvasElementList.map(function (offcanvasEl) {
        return new bootstrap.Offcanvas(offcanvasEl)
    });

    initialize_z_index_controller(".z-index-controller");
    
    //Once the page loads, retrieve mylist from server and set the text for each toggle-my-list to Remove from List button on movie posters
    async function get_list() {
        const response = await fetch(`/mylist/list`);

        try {
            const list = await response.json(); //extract JSON from the http response
            for(let media of list){
                let selector = `.${media.type}-${media.id}`;
                $(selector).addClass("added");
                $(selector).find(".list-button").html(`<i class="bi bi-check-circle-fill"></i> Remove from List`);
            }
        } catch (err) {
            console.log(err);
        }
    }

    get_list();
});

function initialize_z_index_controller(selector){
    //z-index-controller is to make that specific element have a z-index of 9999 to make it appear on the very top when hovered, it will revert back when unhovered
    $(selector).mouseenter(
        (event) => {
            let $target = $(event.currentTarget);
    
            $target.attr("prev-z-index", $target.css("z-index"));
            $target.css("z-index", 9999);
        }).mouseleave(
        (event) => {
            let $target = $(event.currentTarget);
            
            let prev_z_index = $target.attr("prev-z-index");
            $target.css("z-index", prev_z_index);
            $target.removeAttr("prev-z-index");
        });
}

//finds all luxon-format-date and formats it to the clients local timezone
function initialize_all_luxon_date(){
    $(".luxon-format-date").each((index, element) => {
        initialize_luxon_date(element);
    });
}

/**
 * initialize one luxon date
 * current-format: "milliseconds" "js_date_string" "iso"
 * */
function initialize_luxon_date(element){
    let date_element = $(element);
    if(date_element.length != 0){
        if(date_element.hasClass("luxon-format-date-initialized")){
            return;
        }
        let date = date_element.text();
        let current_format = date_element.attr("current-format");
        let error_value = date_element.attr("error-value") ? date_element.attr("error-value") : "";
        let format = date_element.attr("format");
        if(format == null){
            return;
        }
        let DateTime = luxon.DateTime;
        let formatted_date = error_value;

        if(current_format == "milliseconds"){
            let milliseconds = date;
            if(typeof milliseconds != "number"){
                if(isInt(milliseconds)){
                    milliseconds = parseInt(milliseconds);
                }
                else{
                    return;
                }
            }
            formatted_date = DateTime.fromMillis(milliseconds).toFormat(format);
        }
        else if(current_format == "js_date_string"){
            formatted_date = DateTime.fromJSDate(new Date(date)).toFormat(format);
        }
        else if(current_format == "iso"){
            formatted_date = DateTime.fromISO(date).toFormat(format)
        }
        
        if(formatted_date == "Invalid DateTime"){
            formatted_date = error_value;
        }
        date_element.text(formatted_date);
        date_element.addClass("luxon-format-date-initialized");
    }
}

async function remove_all_open_modal(){
    var modal_elements = document.querySelectorAll('.media-modal');
    for(let modal_element of modal_elements){
        var modal = bootstrap.Modal.getOrCreateInstance(modal_element);
        modal.hide();
    }
}

async function add_modal_event(selector){
    $(selector).on("hidden.bs.modal", (event) => {
        $(selector).remove();
    });
}

async function show_media_modal(type, id){
    let selector = `#${type}-${id}-modal`;
    if($(selector).length){
        $(selector).modal("show");
    }
    else{
        if(type == null || id == null){
            return;
        }
        try{
            let response = await fetch(`/media_modal/${type}/${id}`);
            let json = await response.json();
            let modal = json.modal;
            
            remove_all_open_modal();

            $("body").append(modal);

            add_modal_event(selector);
            $(selector).modal("show");
            
            initialize_z_index_controller(`${selector} .z-index-controller`);
            initialize_select($(`${selector} select`));
        } catch(err){
            console.log(err);
        }
    }
}

function toggle_my_list(target, id, type, texts){
    let $poster = $(target).parents(`.${type}-${id}`);
    let added = $poster.hasClass("added");
    if(!added){
        add_to_list(target, id, type, texts);
    }
    else{
        remove_from_list(target, id, type, texts);
    }
}

function add_to_list(target, id, type, pre_render, texts){//texts = examples {add_text: "(icon) Add to List", remove_text: "(icon) Remove from List"}
    let data = {
        id: id,
        type: type,
        pre_render: true
    };
    $.post("/mylist/add", data, function (resp) {
        let result = resp;
        if(result != null && result.success == true){
            let grid_html = `
            <div class="z-index-controller list-item col-6 col-sm-6 col-md-4 col-lg-3 col-xl-2">
                <div class="media-grid-container">
                    ${result.rendered}
                </div>
            </div>`;

            let carousel_html = `
            <div class="carousel-cell z-index-controller">
                ${result.rendered}
            </div>`;
            
            $(".my-list .media-grid").append(grid_html);
            console.log(carousel_html);
            $(".my-list .media-collection, .my-list .media-collection-sm").flickity("append", $.parseHTML(carousel_html));
            $(".my-list .media-collection, .my-list .media-collection-sm").flickity('reloadCells');
            
            $(`.${type}-${id}`).find(`.list-button`).html(`<i class="bi bi-check-circle-fill"></i> Remove from List</button>`)
            $(`.${type}-${id}`).addClass("added");
        }
    });
}

function remove_from_list(target, id, type, texts){
    let data = {
        id: id,
        type: type
    };
    $.post("/mylist/remove", data, function (resp) {
        let result = resp;
        if(result != null && result.success == true){
            $(".my-list").find(`.${type}-${id}`).fadeOut("normal", function() {
                $(".my-list .media-collection, .my-list .media-collection-sm").flickity('remove', $(this).closest(".carousel-cell"));
            });
            $(`.${type}-${id}`).find(`.list-button`).html(`<i class="bi bi-plus-circle"></i> Add to List</button>`)
            $(`.${type}-${id}`).removeClass("added");
        }
    });
}

//Media Collection Initalization
function initialize_media_collection_flickity() {
    $(".media-collection").flickity({
        groupCells: true,
        cellAlign: "center",
        contain: true,
        resize: true,
        percentPosition: false,
        // prevNextButtons: false,
        pageDots: false,
        imagesLoaded: true,
        // wrapAround: true
    });
}

function init_clipboard(){
    new ClipboardJS(".clipboard-button");
}

function visibility_toggler(target) {
    let $target = $(target);
    let $icon = $target.children("i");
    let $visiblity_target = $($target.attr("visibility-target"));

    if ($icon.hasClass('bi-eye-fill')) {
        $visiblity_target.attr("type", "password");
        $icon.removeClass('bi-eye-fill');
        $icon.addClass('bi-eye-slash-fill');
    }
    else {
        $visiblity_target.attr("type", "text");
        $icon.removeClass('bi-eye-slash-fill');
        $icon.addClass('bi-eye-fill');
    }
    /**
     * Sample Code
     * 
            <button onclick="visibility_toggler(this)" visibility-target="#invite_code_input">
                <i class="bi bi-eye-slash-fill"></i>
            </button>
     */
}

//Button href workaround
function goto(link) {
    window.location.href = link;
}

function isInt(value) {
    return !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10));
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generates a random length of characters either from a pre-defined set of characters or a custom set of characters
 * @param {Integer} length  the amount of random characters the string should have
 * @param {String} [customCharacters]  (Optional) a custom set of characters
 * @returns  a random string
 */
 function randomString(length, customCharacters) {
    let result           = "";
    let characters       = customCharacters == null ? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" : customCharacters;
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function set_theme(theme) {
    if (theme == "light") {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", 'light');
    }
    else if (theme == "dark" || theme == "root") {
        document.documentElement.setAttribute("data-theme", "root");
        localStorage.setItem("theme", "root");
    }
}

function check_theme(){
    let current_theme = localStorage.getItem('theme');
    if (current_theme == "light") {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    else if (current_theme == "dark" || current_theme == "root") {
        document.documentElement.setAttribute('data-theme', null);
    }
}
check_theme();
