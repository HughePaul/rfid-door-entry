
class Card extends React.Component {
  handleClick() {
    if(typeof this.props.onSelectCard !== 'function') return;
    this.props.onSelectCard(this.props.card.id);
  }

  render() {
    var card = this.props.card;
    if(!card) return;

    var avatarURL = card.avatar || 'img/user.png';
    var avatarStyle = {
      backgroundImage: 'url(' + avatarURL + ')'
    };

    return (
      <div className={this.props.selected ? 'selected card' : 'card'}
          onClick={this.handleClick.bind(this)}>
        <div className="avatar" style={avatarStyle}></div>
        <div className="cardsName">{card.name}</div>
        <div className="cardsDetail">{card.id}</div>
        <div className="cardsDetail">Level {card.level}</div>
        <div className="clear"></div>
      </div>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.Card = Card;