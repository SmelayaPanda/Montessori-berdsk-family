import * as firebase from 'firebase'
import router from '../../router'

export default {
  // State ---------------------------------------------------
  state: {
    loadedMeetups: []
  },
  // Mutations ---------------------------------------------------
  mutations: { // to change state
    setLoadedMeetups:
      (state, payload) => {
        state.loadedMeetups = payload
      },
    createMeetup:
      (state, payload) => {
        state.loadedMeetups.push(payload)
      },
    updateMeetupData:
      (state, payload) => {
        const meetup = state.loadedMeetups.find((meetup) => {
          return meetup.id === payload.id
        })
        if (payload.title) {
          meetup.title = payload.title
        }
        if (payload.description) {
          meetup.description = payload.description
        }
        if (payload.date) {
          meetup.date = payload.date
        }
        if (payload.imageUrl) {
          meetup.imageUrl = payload.imageUrl
        }
      },
    deleteMeetup:
      (state, payload) => {
        let meetups = state.loadedMeetups
        let removeMeetup = meetups
          .map(function (meetup) {
            return meetup.id
          }).indexOf(payload)
        meetups.splice(removeMeetup, 1)
      }
  },
  // Actions ---------------------------------------------------
  actions: { // specify the mutation
    loadMeetups:
      ({commit}) => {
        commit('setLoading', true)
        // fetch meetup data
        firebase.database().ref('meetups').once('value')
          .then(
            data => {
              const meetups = []
              const obj = data.val() // .val() method of promise ?
              for (let key in obj) {
                meetups.push({
                  id: key,
                  title: obj[key].title,
                  location: obj[key].location,
                  imageUrl: obj[key].imageUrl,
                  description: obj[key].description,
                  date: obj[key].date,
                  creatorId: obj[key].creatorId
                })
              }
              commit('setLoadedMeetups', meetups)
              commit('setLoading', false)
            })
          .catch(
            error => {
              console.log(error)
              commit('setLoading', false)
            })
      },
    createMeetup:
      ({commit, getters}, payload) => {
        const meetup = {
          title: payload.title,
          location: payload.location,
          description: payload.description,
          date: payload.date.toISOString(), // because date object cant be stored into firebase
          creatorId: getters.user.id
          // id generated by firebase automatically as uid property
        }
        // ref('meetup' will create if not exists JSON with name 'meetup'
        // push - for writing new data
        let imageUrl
        let key
        firebase.database().ref('meetups').push(meetup)
        // chain of promises --> then, then, then, catch
          .then(
            data => {
              key = data.key // Promise from firebase have unic id in key property
              // For upload image src into firebase storage:
              // 1. We upload all (except img binary) into firebase database
              // 2. They give as some generated unic id - key
              // 3. With it key we add img binary into firebase storage
              return key
            })
          .then(
            key => {
              return firebase.storage().ref('meetups/' + key).put(payload.image)
            })
          .then(
            fileData => {
              imageUrl = fileData.metadata.downloadURLs[0]
              return firebase.database().ref('meetups').child(key).update({imageUrl: imageUrl})
            })
          .then(
            () => {
              commit('createMeetup', {
                ...meetup,
                imageUrl: imageUrl,
                id: key
              })
            })
          .catch(
            error => {
              console.log(error)
            })
      },
    updateMeetupData:
      ({commit}, payload) => {
        commit('setLoading', true)
        const updateObj = {}
        if (payload.title) {
          updateObj.title = payload.title
        }
        if (payload.description) {
          updateObj.description = payload.description
        }
        if (payload.date) {
          updateObj.date = payload.date
        }
        if (payload.imageUrl) {
          updateObj.imageUrl = payload.imageUrl
        }
        firebase.database().ref('meetups').child(payload.id).update(updateObj)
          .then(() => {
            commit('setLoading', false)
            commit('updateMeetupData', payload)
          })
          .catch(
            error => {
              console.log(error)
              commit('setLoading', false)
            })
      },
    updateMeetupImage:
      ({commit}, payload) => {
        commit('setLoading', true)
        firebase.storage().ref('meetups/' + payload.id).put(payload.image)
          .then(
            fileData => {
              let imageUrl = fileData.metadata.downloadURLs[0]
              console.log('New Image uploaded to storage.')
              firebase.database().ref('meetups').child(payload.id).update({imageUrl: imageUrl})
              commit('updateMeetupData', {id: payload.id, imageUrl: imageUrl})
              commit('setLoading', false)
            })
          .catch((error) => {
            console.log(error)
            commit('setLoading', false)
          })
      },
    deleteMeetup:
      ({commit}, payload) => {
        commit('setLoading', true)
        // remove meetup image
        firebase.storage().ref('meetups/' + payload)
          .delete()
          .then(() => console.log('Image was deleted!'))
          .catch((error) => console.log(error))
        // remove meetup description
        firebase.database().ref('meetups').child(payload)
          .remove()
          .then(
            () => {
              console.log('News description successfully deleted!')
              router.push('/meetups')
              commit('deleteMeetup', payload)
              commit('setLoading', false)
            })
          .catch(
            error => {
              console.log(error)
              commit('setLoading', false)
            })
      }
  },
// Getters  ---------------------------------------------------
  getters: {
    loadedMeetups:
      state => state.loadedMeetups.sort((a, b) => {
        return a.date > b.date
      }),
    loadedMeetup:
      state => (meetupId) => {
        return state.loadedMeetups.find((meetup) => {
          return meetup.id === meetupId
        })
      },
    feuturedMeetups:
      (state, getters) => getters.loadedMeetups.slice(0, 5)
  }
}
