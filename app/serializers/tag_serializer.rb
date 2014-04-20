class TagSerializer < ActiveModel::Serializer
	attributes :avatar, :avatar_thumb, :avatar_medium

	def avatar_thumb
		object.avatar.url(:thumb)
	end

	def avatar_medium
		object.avatar.url(:medium)
	end
end