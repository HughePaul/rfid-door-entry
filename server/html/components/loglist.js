

class LogList extends React.Component {
  render() {

    var logNodes = this.props.logs.map((log) => {
      return (
        <DoorEntry.LogLine
          key={log.id}
          log={log}
          cards={this.props.cards} />
      );
    });

    return (
      <div className="loglist">
        {logNodes}
      </div>
    );
  }
}

if(!window.DoorEntry) window.DoorEntry = {};
window.DoorEntry.LogList = LogList;

