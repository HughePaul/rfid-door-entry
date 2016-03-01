
class CardDetails extends React.Component {
  constructor(props) {
    super(props);
    var card = this.props.card || {};
    this.state = {
      cardId: card.id,
      isModified: false,
      card: Object.assign({}, card)
    };
  }

  componentWillReceiveProps(nextProps) {
    var nextCard = nextProps.card || {};

    // don't update the state if it is the same card and it has been modified
    if(this.state.isModified && this.state.cardId === nextCard.id) return;

    this.setState({
      cardId: nextCard.id,
      isModified: false,
      card: Object.assign({}, nextCard)
    });
  }

  validateLevel(value) {
    var level = parseInt(value, 10);
    if(level > 1 && level < 16) return true;
  }

  hexFilterPad(v, len) {
    len = len || 1;
    if(typeof v === 'string') {
      v = v.toUpperCase()
        .replace(/[^0-9A-F]/g, '')
        .substr(0, len);
    } else {
      v = '';
    }
    // pad right with zeros
    while(v.length < len) {
      v = v + '0'
    }
    return v;
  }

  handlePatternChange(pattern) {
    this.handleChange({pattern: pattern});
  }

  handleChange(prop) {
    if(prop.id) {
      // reformat to X-XXXXXXXXXXXXXX
      var idParts = prop.id.split('-');
      prop.id = this.hexFilterPad(idParts[0], 1) + '-' + this.hexFilterPad(idParts[1], 14);
    }
    if(prop.level) {
      prop.level = parseInt(prop.level, 10);
    }
    var newCard = Object.assign({}, this.state.card, prop);
    this.setState({card: newCard, isModified: true});
  }

  handleSave() {
    if(typeof this.props.onSaveCard !== 'function') return;
    this.props.onSaveCard(this.props.cardId, this.state.card);
    this.setState({isModified: false});
  }

  handleDelete() {
    if(typeof this.props.onDeleteCard !== 'function') return;
    this.props.onDeleteCard(this.props.card.id);
  }

  render() {
    var card = this.state.card;
    var isEnabled = true;
    var isNew = (this.props.cardId === '');

    if(!card || card.id === undefined) {
      isEnabled = false
      card = {};
    }

    var isValid = (!!card.id && !!card.name);

    var avatarURL = card.avatar || 'img/user.png';
    var avatarStyle = {
      backgroundImage: 'url(' + avatarURL + ')'
    };

    return (
      <div className="details">
        <div className="cardavatarimg" style={avatarStyle}></div>
        <div>
          <label>Name:</label>
          <Vendor.InlineEdit
            paramName="name"
            text={card.name || ''}
            enabled={isEnabled}
            change={this.handleChange.bind(this)} />
        </div>
        <div>
          <label>Level:</label>
          <Vendor.InlineEdit
            paramName="level"
            text={'' + (card.level || '')}
            attributes={{type: 'number'}}
            enabled={isEnabled}
            change={this.handleChange.bind(this)} validate={this.validateLevel.bind(this)}/>
        </div>
        <div>
          <label>Card Id:</label>
          <Vendor.InlineEdit
            paramName="id"
            text={card.id || ''}
            enabled={isEnabled}
            change={this.handleChange.bind(this)} />
        </div>
        <div>
          <label>Avatar URL:</label>
          <Vendor.InlineEdit
            paramName="avatar"
            text={card.avatar || ''}
            enabled={isEnabled}
            change={this.handleChange.bind(this)} />
        </div>
        <div>
          <label>Notes:</label>
          <Vendor.InlineEdit
            editingElement="textarea"
            staticElement="pre"
            paramName="notes"
            attributes={{rows: 3}}
            text={card.notes || ''}
            enabled={isEnabled}
            change={this.handleChange.bind(this)} />
        </div>

        <div>
          <DoorEntry.TimePattern
            enabled={isEnabled}
            pattern={card.pattern || ''}
            onChange={this.handlePatternChange.bind(this)}/>
        </div>

        <button onClick={this.handleSave.bind(this)} disabled={!isEnabled || !this.state.isModified || !isValid}>Save</button>
        <button onClick={this.handleDelete.bind(this)} disabled={!isEnabled || isNew}>Delete</button>
      </div>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.CardDetails = CardDetails;

