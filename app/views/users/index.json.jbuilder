json.array!(@users) do |user|
  json.extract! user, :id, :username, :administrator
  json.url user_url(user, format: :json)
end
