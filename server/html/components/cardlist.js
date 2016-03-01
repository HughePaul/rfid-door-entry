

class CardList extends React.Component {
  render() {
    // convert object of cards into sorted array
    var cardIds = Object.keys(this.props.cards);
    var cardArray = cardIds.map( (id) => this.props.cards[id] );

    cardArray.sort( (a,b) => {
      a = (a && a.name || '').toLowerCase();
      b = (b && b.name || '').toLowerCase();
      return a > b ? 1 : (a < b ? -1 : 0);
    });

    // or if lodash is used:
    //var cardArray = _.sortBy(this.props.cards, (c) => c.name);

    var cardNodes = cardArray.map((card) => {
      return (
        <DoorEntry.Card
          key={card.id}
          card={card}
          selected={this.props.selectedCardId === card.id}
          onSelectCard={this.props.onSelectCard} />
      );
    });

    return (
      <div className="cardlist">
        {cardNodes}
      </div>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.CardList = CardList;

