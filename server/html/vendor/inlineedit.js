/*
The MIT License (MIT)
Copyright (c) 2014 Kai Vik

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

https://github.com/kaivi/ReactInlineEdit

*/

function selectInputText(element) {
    element.setSelectionRange(0, element.value.length);
}

var InlineEdit = React.createClass({
    propTypes: {
        text: React.PropTypes.string.isRequired,
        paramName: React.PropTypes.string.isRequired,
        change: React.PropTypes.func.isRequired,
        placeholder: React.PropTypes.string,
        className: React.PropTypes.string,
        activeClassName: React.PropTypes.string,
        minLength: React.PropTypes.number,
        maxLength: React.PropTypes.number,
        validate: React.PropTypes.func,
        style: React.PropTypes.object,
        editingElement: React.PropTypes.string,
        staticElement: React.PropTypes.string,
        tabIndex: React.PropTypes.number,
        enabled: React.PropTypes.bool,
        attributes: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            minLength: 1,
            maxLength: 256,
            enabled: true,
            editingElement: 'input',
            staticElement: 'span',
            tabIndex: 0,
        };
    },

    getInitialState: function() {
        return {
            editing: false,
            text: this.props.text,
            minLength: this.props.minLength,
            maxLength: this.props.maxLength,
        };
    },

    componentWillMount: function() {
        this.isInputValid = this.props.validate || this.isInputValid;
        // Warn about deprecated elements
        if (this.props.element) {
            console.warn('`element` prop is deprecated: instead pass editingElement or staticElement to InlineEdit component');
        }
    },

    componentWillReceiveProps: function(nextProps) {
        if (nextProps.text !== this.props.text) {
            this.setState({ text: nextProps.text });
        }
        if(this.state.editing && !nextProps.enabled) {
            this.setState({ editing: false });
        }
    },

    componentDidUpdate: function(prevProps, prevState) {
        let inputElem = ReactDOM.findDOMNode(this.refs.input);
        if (this.state.editing && !prevState.editing) {
            inputElem.focus();
            selectInputText(inputElem);
        } else if (this.state.editing && prevProps.text != this.props.text) {
            this.finishEditing();
        }
    },

    startEditing: function(e) {
        if (this.props.stopPropagation) {
            e.stopPropagation()
        }
        if(!this.props.enabled) return;
        this.setState({editing: true, text: this.props.text});
    },

    finishEditing: function() {
        if (this.isInputValid(this.state.text) && this.props.text != this.state.text){
            this.commitEditing();
        } else if (this.props.text === this.state.text || !this.isInputValid(this.state.text)) {
            this.cancelEditing();
        }
    },

    cancelEditing: function() {
        this.setState({editing: false, text: this.props.text});
    },

    commitEditing: function() {
        this.setState({editing: false, text: this.state.text});
        let newProp = {};
        newProp[this.props.paramName] = this.state.text;
        this.props.change(newProp);
    },

    clickWhenEditing: function(e) {
        if (this.props.stopPropagation) {
            e.stopPropagation();
        }
    },

    isInputValid: function(text) {
        return (text.length >= this.state.minLength && text.length <= this.state.maxLength);
    },

    keyDown: function(event) {
        if (event.keyCode === 13) {
            this.finishEditing();
        } else if (event.keyCode === 27) {
            this.cancelEditing();
        }
    },

    textChanged: function(event) {
        this.setState({
            text: event.target.value.trim()
        });
    },

    render: function() {
        if (!this.state.editing) {
            const Element = this.props.element || this.props.staticElement;
            return <Element
                className={this.props.className}
                onClick={this.startEditing}
                tabIndex={this.props.tabIndex}
                style={this.props.style} >
                {this.state.text || this.props.placeholder}
            </Element>;
        } else {
            const Element = this.props.element || this.props.editingElement;
            return <Element
                onClick={this.clickWhenEditing}
                onKeyDown={this.keyDown}
                onBlur={this.finishEditing}
                className={this.props.activeClassName}
                placeholder={this.props.placeholder}
                defaultValue={this.state.text}
                onReturn={this.finishEditing}
                onChange={this.textChanged}
                style={this.props.style}
                ref="input"
                {...this.props.attributes}
                />;
        }
    }
});

if(!window.Vendor) window.Vendor = {};
window.Vendor.InlineEdit = InlineEdit;
