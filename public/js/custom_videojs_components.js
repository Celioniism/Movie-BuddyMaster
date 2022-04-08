var Component = videojs.getComponent('Component');

class Spacer extends Component {
    constructor(player, options){
        super(options);
    }

    createEl (){
        let extraClasses = this.options().classes ? this.options().classes : "";

        return videojs.dom.createEl('div', {

            // Prefixing classes of elements within a player with "vjs-" 
            // is a con9vention used in Video.js.
            className: 'vjs-spacer ' + extraClasses
        });
    }
}

/*
 An overlay panel for video js
*/
class Panel extends Component {

    /*
        classes : a string with classes seperated by a space
        defaultValues : true or false, if true the overlay will NOT disappear 
    */
    constructor(player, options){
        super(player, options);
    }

    createEl (){
        let classes = this.options().defaultValues ? "" : "vjs-overlay-panel ";
        classes += this.options().classes ? this.options().classes : "";

        return videojs.dom.createEl('div', {

            // Prefixing classes of elements within a player with "vjs-" 
            // is a con9vention used in Video.js.
            className: 'animate__animated ' + classes
        });
    }

}

class Text extends Component {

    /*
        classes : a string with classes seperated by a space
        text : the text to display
    */
    constructor (player, options) {

        // It is important to invoke the superclass before anything else, 
        // to get all the features of components out of the box!
        super(player, options);

        // If a `text` option was passed in, update the text content of 
        // the component.
        if (options.text) {
            this.updateTextContent(options.text);
        }
    }

    createEl (){
        let extraClasses = this.options().classes ? this.options().classes : "";

        return videojs.createEl('div', {

            // Prefixing classes of elements within a player with "vjs-" 
            // is a convention used in Video.js.
            className: 'vjs-text animate__animated ' + extraClasses
        });
    }
    
    updateTextContent (text) {
        // If no text was provided, default to "Title Unknown"
        if (typeof text !== 'string') {
            text = 'Title Unknown';
        }

        // Use Video.js utility DOM methods to manipulate the content
        // of the component's element.
        videojs.dom.emptyEl(this.el());
        videojs.dom.appendContent(this.el(), text);
    }
}

class Button extends Component {

    /*
        classes : a string with classes seperated by a space
        text : the text to display
        innerHTML : the innerHTML

        onclick: function name to be called when clicked
    */
    constructor (player, options) {
        super(player, options);
    }

    createEl (){
        let extraClasses = this.options().classes ? this.options().classes : "";
        let innerHTML = this.options().innerHTML ? this.options().innerHTML : "";
            //vjs-btn animate__animated 
        let button = videojs.dom.createEl('button', {
            // Prefixing classes of elements within a player with "vjs-" 
            // is a convention used in Video.js.
            className: extraClasses,
            innerHTML: innerHTML
        });
        return button;
    }

}

class Custom extends Component {
    constructor (player, options) {
        super(player, options);
    }

    createEl (){
        let extraClasses = this.options().classes ? this.options().classes : "";
        let innerHTML = this.options().innerHTML ? this.options().innerHTML : "";

        let custom = videojs.dom.createEl('div', {
            className: extraClasses,
            innerHTML: innerHTML
        });
        return custom;
    }
}