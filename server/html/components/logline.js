
class LogLine extends React.Component {
  render() {
    var log = this.props.log;
    if(!log) return;

    var logNodes = [];
    var textNodes = [];

    if(log.reader) {
      logNodes.push( <div key="reader" className="reader">{log.reader}</div> );
    }

    var card = log.card;

    if(!card && log.cardid && this.props.cards) {
      card = this.props.cards[log.cardid];
    }

    if(card) {
      textNodes.push( <DoorEntry.Card key="card" card={card} /> );
    } else {
      textNodes.push( <div key="desc">{log.desc}</div> );

      if(log.level) {
        textNodes.push( <div key="level">Level {log.level}</div> );
      }
    }

    return (
      <div className={'log ' + log.type}>
        <span className="timestamp">{log.timestamp}</span>
        <div className="type">{log.type}</div>
        {logNodes}
        <div className="text">
          {textNodes}
        </div>
        <div className="clear" />
      </div>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.LogLine = LogLine;